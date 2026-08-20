import type { EptFeature, UnifiedSearchItem } from "../core/types";

const DEFAULT_CLIP_SERVICE_URL = "https://usalidar.io";
const MAX_CLIP_AREA_SQ_MI = 5;

interface ClipOrderFile {
  filename: string;
}
interface ClipOrder {
  order_token: string;
  status: string;
  output_files?: ClipOrderFile[];
  error_message?: string | null;
}
interface ClipServiceResponse {
  success: boolean;
  message?: string;
  data?: ClipOrder;
  errors?: Record<string, string[]>;
}

export interface CopcClipResult {
  filename: string;
  downloadUrl: string;
}
export interface CopcClipOptions {
  serviceUrl?: string;
  fetch?: typeof globalThis.fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

function bboxPolygon(bbox: [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

/** Approximate the area of a WGS84 bounding box in square miles. */
export function bboxAreaSquareMiles(
  bbox: [number, number, number, number],
): number {
  const [west, south, east, north] = bbox;
  const meanLatitude = ((south + north) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(east - west) * 111.32 * Math.cos(meanLatitude);
  const heightKm = Math.abs(north - south) * 110.574;
  return (widthKm * heightKm) / 2.589988;
}

function responseError(
  response: ClipServiceResponse,
  fallback: string,
): string {
  if (response.errors) return Object.values(response.errors).flat().join(" ");
  return response.message || fallback;
}

/** Submit an EPT crop and wait until the service has produced a COPC file. */
export async function requestEptCopcClip(
  items: UnifiedSearchItem[],
  bbox: [number, number, number, number],
  options: CopcClipOptions = {},
): Promise<CopcClipResult> {
  const eptItems = items.filter((item) => item.sourceType === "ept");
  if (eptItems.length === 0)
    throw new Error("Select at least one EPT dataset to export");

  const area = bboxAreaSquareMiles(bbox);
  if (area > MAX_CLIP_AREA_SQ_MI) {
    throw new Error(
      `The drawn area is ${area.toFixed(2)} square miles. COPC exports are limited to ${MAX_CLIP_AREA_SQ_MI} square miles.`,
    );
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  const serviceUrl = (options.serviceUrl ?? DEFAULT_CLIP_SERVICE_URL).replace(
    /\/$/,
    "",
  );
  const polygon = bboxPolygon(bbox);
  const filenameBase = `usgs_lidar_clip_${Date.now()}`;
  const readers = eptItems.map((item, index) => ({
    type: "readers.ept",
    filename: (item.originalItem as EptFeature).properties.url,
    polygon: JSON.stringify(polygon.geometry),
    tag: `ept_${index + 1}`,
  }));
  const pdalPipeline: Record<string, unknown>[] = [...readers];
  if (readers.length > 1) {
    pdalPipeline.push({
      type: "filters.merge",
      inputs: readers.map((reader) => reader.tag),
      tag: "merged",
    });
  }
  const datasets = eptItems.map((item) => ({
    id: item.id,
    name: item.id,
    url: (item.originalItem as EptFeature).properties.url,
    percentage: 100,
  }));

  const submit = await fetcher(`${serviceUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: filenameBase,
      aoi_area: area,
      total_coverage_area: area,
      usage_sqmi: area,
      polygon,
      datasets,
      processing_options: {
        type: "standard",
        output_format: "copc_laz",
        quality: "standard",
        target_crs: "",
      },
      pdal_pipeline: pdalPipeline,
    }),
  });
  const submitted = (await submit.json()) as ClipServiceResponse;
  if (!submit.ok || !submitted.success || !submitted.data?.order_token) {
    throw new Error(
      responseError(submitted, `COPC export request failed (${submit.status})`),
    );
  }

  const token = submitted.data.order_token;
  const pollIntervalMs = options.pollIntervalMs ?? 1500;
  const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
  let order = submitted.data;
  while (order.status !== "completed") {
    if (order.status === "failed")
      throw new Error(order.error_message || "COPC export failed");
    if (Date.now() >= deadline) throw new Error("COPC export timed out");
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetcher(
      `${serviceUrl}/api/orders/${token}/status`,
    );
    const status = (await statusResponse.json()) as ClipServiceResponse;
    if (!statusResponse.ok || !status.success || !status.data) {
      throw new Error(
        responseError(
          status,
          `Could not check COPC export status (${statusResponse.status})`,
        ),
      );
    }
    order = status.data;
  }

  const file = order.output_files?.find((candidate) =>
    candidate.filename.endsWith(".copc.laz"),
  );
  if (!file) throw new Error("COPC export completed without an output file");
  return {
    filename: file.filename,
    downloadUrl: `${serviceUrl}/download/${token}/${encodeURIComponent(file.filename)}`,
  };
}
