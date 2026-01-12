// Import styles
import './lib/styles/usgs-lidar-control.css';

// Main entry point - Core exports
export { UsgsLidarControl } from './lib/core/UsgsLidarControl';

// Adapter exports
export { UsgsLidarLayerAdapter } from './lib/adapters';

// STAC exports
export { StacSearcher } from './lib/stac';

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
} from './lib/core/types';

export type { FootprintLayerOptions } from './lib/results';

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
} from './lib/utils';
