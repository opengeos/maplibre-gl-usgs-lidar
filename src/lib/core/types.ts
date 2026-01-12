import type { Map as MapLibreMap } from 'maplibre-gl';
import type { LidarControlOptions, LidarState, PointCloudInfo } from 'maplibre-gl-lidar';
import type { Feature, Polygon } from 'geojson';

/**
 * STAC Link object
 */
export interface StacLink {
  rel: string;
  href: string;
  type?: string;
  title?: string;
}

/**
 * STAC Asset object
 */
export interface StacAsset {
  href: string;
  type?: string;
  title?: string;
  roles?: string[];
  description?: string;
}

/**
 * STAC Item from Planetary Computer 3dep-lidar-copc collection
 */
export interface StacItem {
  id: string;
  type: 'Feature';
  stac_version: string;
  stac_extensions?: string[];
  geometry: GeoJSON.Geometry;
  bbox: [number, number, number, number] | [number, number, number, number, number, number];
  properties: {
    datetime: string | null;
    'proj:epsg'?: number;
    'pointcloud:count'?: number;
    'pc:count'?: number;
    'pointcloud:type'?: string;
    'pc:type'?: string;
    'pointcloud:encoding'?: string;
    'pc:encoding'?: string;
    start_datetime?: string;
    end_datetime?: string;
    title?: string;
    description?: string;
    [key: string]: unknown;
  };
  links: StacLink[];
  assets: {
    data?: StacAsset;
    [key: string]: StacAsset | undefined;
  };
  collection: string;
}

/**
 * STAC Search API response
 */
export interface StacSearchResponse {
  type: 'FeatureCollection';
  features: StacItem[];
  links?: StacLink[];
  context?: {
    returned: number;
    limit: number;
    matched?: number;
  };
  numberMatched?: number;
  numberReturned?: number;
}

/**
 * Search parameters for STAC API
 */
export interface StacSearchParams {
  /** Bounding box [west, south, east, north] */
  bbox?: [number, number, number, number];
  /** GeoJSON geometry for spatial filtering */
  intersects?: GeoJSON.Geometry;
  /** ISO 8601 datetime or range */
  datetime?: string;
  /** Maximum items to return */
  limit?: number;
  /** Sort order */
  sortby?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

/**
 * Options for configuring the UsgsLidarControl
 */
export interface UsgsLidarControlOptions {
  /**
   * Whether the control panel should start collapsed
   * @default true
   */
  collapsed?: boolean;

  /**
   * Position of the control on the map
   * @default 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Title displayed in the control header
   * @default 'USGS 3DEP LiDAR'
   */
  title?: string;

  /**
   * Width of the control panel in pixels
   * @default 380
   */
  panelWidth?: number;

  /**
   * Maximum height of the control panel in pixels
   * @default 600
   */
  panelMaxHeight?: number;

  /**
   * Custom CSS class name
   */
  className?: string;

  /**
   * Maximum results per search
   * @default 50
   */
  maxResults?: number;

  /**
   * Show footprints on map when results are displayed
   * @default true
   */
  showFootprints?: boolean;

  /**
   * Auto-zoom to footprints when showing results
   * @default true
   */
  autoZoomToResults?: boolean;

  /**
   * Options to pass to the internal LidarControl
   */
  lidarControlOptions?: Partial<LidarControlOptions>;
}

/**
 * Search mode for the control
 */
export type SearchMode = 'extent' | 'draw' | 'none';

/**
 * Internal state of the USGS LiDAR control
 */
export interface UsgsLidarState {
  /** Whether the panel is collapsed */
  collapsed: boolean;
  /** Panel width in pixels */
  panelWidth: number;
  /** Panel max height in pixels */
  panelMaxHeight: number;

  /** Current search mode */
  searchMode: SearchMode;
  /** Whether user is currently drawing a bbox */
  isDrawing: boolean;
  /** The drawn bounding box */
  drawnBbox: [number, number, number, number] | null;

  /** Search results */
  searchResults: StacItem[];
  /** Selected item IDs */
  selectedItems: Set<string>;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Search error message */
  searchError: string | null;
  /** Total matched items from search */
  totalMatched: number | null;

  /** Map of loaded items (itemId -> PointCloudInfo) */
  loadedItems: Map<string, PointCloudInfo>;
  /** Current LiDAR control state */
  lidarState: LidarState | null;
}

/**
 * Event types emitted by the control
 */
export type UsgsLidarControlEvent =
  | 'collapse'
  | 'expand'
  | 'statechange'
  | 'searchstart'
  | 'searchcomplete'
  | 'searcherror'
  | 'itemselect'
  | 'itemdeselect'
  | 'loadstart'
  | 'loadcomplete'
  | 'loaderror'
  | 'unload'
  | 'drawstart'
  | 'drawend';

/**
 * Event data passed to event handlers
 */
export interface UsgsLidarEventData {
  type: UsgsLidarControlEvent;
  state: UsgsLidarState;
  items?: StacItem[];
  error?: Error;
  pointCloud?: PointCloudInfo;
  /** Item ID for unload events */
  itemId?: string;
}

/**
 * Event handler function type
 */
export type UsgsLidarEventHandler = (event: UsgsLidarEventData) => void;

/**
 * Drawn rectangle feature from GeoEditor
 */
export type DrawnRectangle = Feature<Polygon>;

/**
 * Props for the React wrapper component
 */
export interface UsgsLidarControlReactProps extends UsgsLidarControlOptions {
  /** MapLibre GL map instance */
  map: MapLibreMap;
  /** Geoman instance for drawing */
  geoman?: unknown;
  /** Callback fired when the control state changes */
  onStateChange?: (state: UsgsLidarState) => void;
  /** Callback fired when search completes */
  onSearchComplete?: (items: StacItem[]) => void;
  /** Callback fired when a point cloud is loaded */
  onItemLoad?: (pointCloud: PointCloudInfo) => void;
  /** Callback fired when an error occurs */
  onError?: (error: Error) => void;
  /** Callback to receive the internal control instance */
  onControlReady?: (control: UsgsLidarControl) => void;
}

// Forward declaration for the control type
export type UsgsLidarControl = import('./UsgsLidarControl').UsgsLidarControl;
