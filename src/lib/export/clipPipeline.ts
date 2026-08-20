import type { EptFeature, UnifiedSearchItem } from '../core/types';

const WEB_MERCATOR_RADIUS = 6378137;
const MAX_MERCATOR_LATITUDE = 85.0511287798066;

export interface PdalStage {
  type: string;
  [key: string]: unknown;
}

export interface PdalPipeline {
  pipeline: PdalStage[];
}

/** Convert a WGS84 bounding box to the native EPSG:3857 coordinates of USGS EPT. */
export function projectBboxToWebMercator(bbox: [number, number, number, number]): [number, number, number, number] {
  const [west, south, east, north] = bbox;
  const project = (longitude: number, latitude: number): [number, number] => {
    const clampedLatitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));
    const x = WEB_MERCATOR_RADIUS * ((longitude * Math.PI) / 180);
    const y = WEB_MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLatitude * Math.PI) / 360));
    return [x, y];
  };

  const [minX, minY] = project(west, south);
  const [maxX, maxY] = project(east, north);
  return [minX, minY, maxX, maxY];
}

/** Build a PDAL pipeline that reads only a drawn area from selected USGS EPT datasets. */
export function buildEptClipPipeline(
  items: UnifiedSearchItem[],
  bbox: [number, number, number, number],
  outputFilename = 'usgs-lidar-clip.laz'
): PdalPipeline {
  const eptItems = items.filter((item) => item.sourceType === 'ept');
  if (eptItems.length === 0) {
    throw new Error('Select at least one EPT dataset to export');
  }

  const [minX, minY, maxX, maxY] = projectBboxToWebMercator(bbox);
  const bounds = `([${minX.toFixed(3)}, ${maxX.toFixed(3)}], [${minY.toFixed(3)}, ${maxY.toFixed(3)}])`;
  const readerTags = eptItems.map((_, index) => `ept_${index + 1}`);
  const readers: PdalStage[] = eptItems.map((item, index) => ({
    type: 'readers.ept',
    filename: (item.originalItem as EptFeature).properties.url,
    bounds,
    tag: readerTags[index]
  }));

  const pipeline: PdalStage[] = [...readers];
  let writerInput = readerTags;
  if (readerTags.length > 1) {
    pipeline.push({ type: 'filters.merge', inputs: readerTags, tag: 'merged' });
    writerInput = ['merged'];
  }
  pipeline.push({
    type: 'writers.las',
    filename: outputFilename,
    compression: 'laszip',
    inputs: writerInput
  });

  return { pipeline };
}
