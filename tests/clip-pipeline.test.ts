import { describe, expect, it } from 'vitest';
import { buildEptClipPipeline, projectBboxToWebMercator } from '../src/lib/export';
import type { EptFeature, UnifiedSearchItem } from '../src/lib/core/types';

function eptItem(id: string): UnifiedSearchItem {
  const url = `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/${id}/ept.json`;
  const originalItem: EptFeature = {
    type: 'Feature',
    properties: { name: id, count: 100, url },
    geometry: { type: 'Polygon', coordinates: [] }
  };
  return {
    id,
    type: 'Feature',
    geometry: originalItem.geometry,
    bbox: [-123, 38, -122, 39],
    properties: { name: id, url },
    sourceType: 'ept',
    originalItem
  };
}

describe('EPT clip pipeline', () => {
  it('projects WGS84 bounds to Web Mercator', () => {
    const projected = projectBboxToWebMercator([-123, 38, -122, 39]);
    expect(projected[0]).toBeCloseTo(-13692297.368, 2);
    expect(projected[1]).toBeCloseTo(4579425.813, 2);
    expect(projected[2]).toBeCloseTo(-13580977.877, 2);
    expect(projected[3]).toBeCloseTo(4721671.573, 2);
  });

  it('builds a bounded LAZ pipeline for one EPT dataset', () => {
    const result = buildEptClipPipeline([eptItem('survey-a')], [-123, 38, -122, 39]);
    expect(result.pipeline).toHaveLength(2);
    expect(result.pipeline[0]).toMatchObject({
      type: 'readers.ept',
      filename: 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/survey-a/ept.json',
      tag: 'ept_1'
    });
    expect(result.pipeline[0].bounds).toContain('-13692297.368');
    expect(result.pipeline[1]).toEqual({
      type: 'writers.las',
      filename: 'usgs-lidar-clip.laz',
      compression: 'laszip',
      inputs: ['ept_1']
    });
  });

  it('merges multiple selected datasets before writing', () => {
    const result = buildEptClipPipeline([eptItem('survey-a'), eptItem('survey-b')], [-123, 38, -122, 39]);
    expect(result.pipeline[2]).toEqual({
      type: 'filters.merge',
      inputs: ['ept_1', 'ept_2'],
      tag: 'merged'
    });
    expect(result.pipeline[3].inputs).toEqual(['merged']);
  });

  it('rejects a pipeline without an EPT selection', () => {
    expect(() => buildEptClipPipeline([], [-123, 38, -122, 39])).toThrow('Select at least one EPT dataset to export');
  });
});
