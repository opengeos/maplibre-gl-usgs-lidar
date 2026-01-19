// Import styles
import './lib/styles/usgs-lidar-control.css';

// Main entry point - Core exports
export { UsgsLidarControl } from './lib/core/UsgsLidarControl';

// Adapter exports
export { UsgsLidarLayerAdapter } from './lib/adapters';

// STAC exports
export { StacSearcher } from './lib/stac';

// EPT exports
export { EptSearcher } from './lib/ept';

// Results exports
export { FootprintLayer } from './lib/results';

// Type exports
export type {
  UsgsLidarControlOptions,
  UsgsLidarState,
  UsgsLidarControlEvent,
  UsgsLidarEventHandler,
  UsgsLidarEventData,
  StacItem,
  StacSearchParams,
  StacSearchResponse,
  StacAsset,
  StacLink,
  SearchMode,
  LoadedItemInfo,
  // New types for EPT support
  DataSourceType,
  EptFeature,
  EptSearchResponse,
  UnifiedSearchItem,
  CacheEntry,
  // Metadata types (re-exported from maplibre-gl-lidar)
  PointCloudFullMetadata,
  DimensionInfo,
  CopcMetadata,
  EptExtendedMetadata,
  // Cross-section types (re-exported from maplibre-gl-lidar)
  CrossSectionLine,
  ProfilePoint,
  ElevationProfile,
} from './lib/core/types';

export type { FootprintLayerOptions } from './lib/results';

// Re-export colormap types from maplibre-gl-lidar
export type { ColormapName, ColorRangeConfig } from 'maplibre-gl-lidar';

// Utility exports
export {
  clamp,
  formatNumber,
  formatPointCount,
  formatBbox,
  generateId,
  debounce,
  throttle,
  classNames,
  truncate,
  getItemShortName,
  getBboxFromGeometry,
  // New converter utilities
  stacToUnified,
  eptToUnified,
  getUnifiedItemName,
  getUnifiedItemMetadata,
} from './lib/utils';
