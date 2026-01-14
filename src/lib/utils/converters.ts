import type { StacItem, EptFeature, UnifiedSearchItem } from '../core/types';
import { getBboxFromGeometry, formatPointCount } from './helpers';

/**
 * Converts a STAC item to a unified search item.
 *
 * @param item - STAC item from Planetary Computer
 * @returns Unified search item
 */
export function stacToUnified(item: StacItem): UnifiedSearchItem {
  // Handle both 4-element and 6-element bboxes
  const bbox: [number, number, number, number] =
    item.bbox.length === 6
      ? [item.bbox[0], item.bbox[1], item.bbox[3], item.bbox[4]]
      : (item.bbox as [number, number, number, number]);

  // Extract point count (both property names are used)
  const pointCount =
    (item.properties['pc:count'] as number | undefined) ??
    (item.properties['pointcloud:count'] as number | undefined);

  // Clean up item name
  const name = item.id.replace(/^USGS_LPC_/, '').replace(/^3DEP_/, '');

  return {
    id: item.id,
    type: 'Feature',
    geometry: item.geometry,
    bbox,
    properties: {
      name,
      pointCount,
      datetime: item.properties.datetime,
    },
    sourceType: 'copc',
    originalItem: item,
  };
}

/**
 * Converts an EPT feature to a unified search item.
 *
 * @param feature - EPT feature from boundaries
 * @returns Unified search item
 */
export function eptToUnified(feature: EptFeature): UnifiedSearchItem {
  const bbox: [number, number, number, number] =
    feature.bbox ?? (getBboxFromGeometry(feature.geometry) as [number, number, number, number]);

  return {
    id: feature.properties.name, // Use name as ID
    type: 'Feature',
    geometry: feature.geometry,
    bbox,
    properties: {
      name: feature.properties.name,
      pointCount: feature.properties.count,
      url: feature.properties.url,
      datetime: null, // EPT doesn't have datetime
    },
    sourceType: 'ept',
    originalItem: feature,
  };
}

/**
 * Extracts the short display name from a unified item.
 *
 * @param item - Unified search item
 * @param maxLength - Maximum length (default: 30)
 * @returns Short display name
 */
export function getUnifiedItemName(item: UnifiedSearchItem, maxLength: number = 30): string {
  let name = item.properties.name;
  if (name.length > maxLength) {
    return name.substring(0, maxLength - 3) + '...';
  }
  return name;
}

/**
 * Gets metadata string for a unified item.
 *
 * @param item - Unified search item
 * @returns Metadata string
 */
export function getUnifiedItemMetadata(item: UnifiedSearchItem): string {
  const parts: string[] = [];

  if (item.properties.pointCount) {
    parts.push(formatPointCount(item.properties.pointCount));
  }

  if (item.properties.datetime) {
    try {
      const year = new Date(item.properties.datetime).getFullYear();
      if (!isNaN(year)) parts.push(String(year));
    } catch {
      // Ignore date parsing errors
    }
  }

  // Add source indicator
  parts.push(item.sourceType === 'copc' ? 'COPC' : 'EPT');

  return parts.join(' \u2022 '); // Unicode bullet
}
