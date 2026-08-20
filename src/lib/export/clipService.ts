import type { EptFeature, UnifiedSearchItem } from '../core/types';

const DEFAULT_CLIP_SERVICE_URL = 'https://usalidar.io';
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

/** Start a cross-origin attachment download without relying on a delayed popup. */
export function startBrowserDownload(downloadUrl: string): void {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.src = downloadUrl;
  document.body.appendChild(frame);

  // Attachment navigations do not consistently fire load, so clean up later.
  window.setTimeout(() => frame.remove(), 60_000);
}

function bboxPolygon(bbox: [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
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

function bboxPolygonWkt(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  return `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))/EPSG:4326`;
}

/** Approximate the area of a WGS84 bounding box in square miles. */
export function bboxAreaSquareMiles(bbox: [number, number, number, number]): number {
  const [west, south, east, north] = bbox;
  const meanLatitude = ((south + north) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(east - west) * 111.32 * Math.cos(meanLatitude);
  const heightKm = Math.abs(north - south) * 110.574;
  return (widthKm * heightKm) / 2.589988;
}

function responseError(response: ClipServiceResponse, fallback: string): string {
  if (response.errors) return Object.values(response.errors).flat().join(' ');
  return response.message || fallback;
}

/** Submit an EPT crop and wait until the service has produced a COPC file. */
export async function requestEptCopcClip(
  items: UnifiedSearchItem[],
  bbox: [number, number, number, number],
  options: CopcClipOptions = {}
): Promise<CopcClipResult> {
  const eptItems = items.filter((item) => item.sourceType === 'ept');
  if (eptItems.length === 0) throw new Error('Select at least one EPT dataset to export');

  const area = bboxAreaSquareMiles(bbox);
  if (area > MAX_CLIP_AREA_SQ_MI) {
    throw new Error(
      `The drawn area is ${area.toFixed(2)} square miles. COPC exports are limited to ${MAX_CLIP_AREA_SQ_MI} square miles.`
    );
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  const serviceUrl = (options.serviceUrl ?? DEFAULT_CLIP_SERVICE_URL).replace(/\/$/, '');
  const polygon = bboxPolygon(bbox);
  const polygonWkt = bboxPolygonWkt(bbox);
  const filenameBase = `usgs_lidar_clip_${Date.now()}`;
  const readers = eptItems.map((item, index) => ({
    type: 'readers.ept',
    filename: (item.originalItem as EptFeature).properties.url,
    polygon: polygonWkt,
    tag: `ept_${index + 1}`,
  }));
  const pdalPipeline: Record<string, unknown>[] = [...readers];
  if (readers.length > 1) {
    pdalPipeline.push({
      type: 'filters.merge',
      inputs: readers.map((reader) => reader.tag),
      tag: 'merged',
    });
  }
  const datasets = eptItems.map((item) => ({
    id: item.id,
    name: item.id,
    url: (item.originalItem as EptFeature).properties.url,
    percentage: 100,
  }));

  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const submit = await fetcher(`${serviceUrl}/api/orders`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: filenameBase,
        aoi_area: area,
        total_coverage_area: area,
        usage_sqmi: area,
        polygon,
        datasets,
        processing_options: {
          type: 'standard',
          output_format: 'copc_laz',
          quality: 'standard',
          target_crs: '',
        },
        pdal_pipeline: pdalPipeline,
      }),
    });
    const submitted = (await submit.json()) as ClipServiceResponse;
    if (!submit.ok || !submitted.success || !submitted.data?.order_token) {
      throw new Error(responseError(submitted, `COPC export request failed (${submit.status})`));
    }

    const token = submitted.data.order_token;
    const pollIntervalMs = options.pollIntervalMs ?? 1500;
    let order = submitted.data;
    while (order.status !== 'completed') {
      if (order.status === 'failed') throw new Error(order.error_message || 'COPC export failed');
      if (Date.now() >= deadline) throw new Error('COPC export timed out');
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      if (Date.now() >= deadline) throw new Error('COPC export timed out');
      const statusResponse = await fetcher(`${serviceUrl}/api/orders/${token}/status`, {
        signal: controller.signal,
      });
      const status = (await statusResponse.json()) as ClipServiceResponse;
      if (!statusResponse.ok || !status.success || !status.data) {
        throw new Error(
          responseError(status, `Could not check COPC export status (${statusResponse.status})`)
        );
      }
      order = status.data;
    }

    const file = order.output_files?.find((candidate) => candidate.filename.endsWith('.copc.laz'));
    if (!file) throw new Error('COPC export completed without an output file');
    return {
      filename: file.filename,
      downloadUrl: `${serviceUrl}/download/${token}/${encodeURIComponent(file.filename)}`,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error('COPC export timed out') as Error & { cause?: unknown };
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
