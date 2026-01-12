/**
 * Clamps a value between a minimum and maximum.
 *
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats a number for display with appropriate precision.
 *
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(decimals);
}

/**
 * Formats a point count for display.
 *
 * @param count - The point count
 * @returns Formatted string like "11.4M pts" or "500K pts"
 */
export function formatPointCount(count: number | undefined): string {
  if (count === undefined || count === null) return '';
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M pts`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(0)}K pts`;
  }
  return `${count} pts`;
}

/**
 * Formats a bounding box for display.
 *
 * @param bbox - Bounding box [west, south, east, north]
 * @returns Formatted string
 */
export function formatBbox(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  return `${west.toFixed(2)}, ${south.toFixed(2)} to ${east.toFixed(2)}, ${north.toFixed(2)}`;
}

/**
 * Generates a unique ID with optional prefix.
 *
 * @param prefix - Optional prefix
 * @returns Unique ID string
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Debounces a function call.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttles a function call.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn(...args);
    }
  };
}

/**
 * Creates a CSS class name string from multiple class names.
 *
 * @param classNames - Class names (strings or falsy values)
 * @returns Combined class name string
 */
export function classNames(
  ...classNames: (string | undefined | null | false)[]
): string {
  return classNames.filter(Boolean).join(' ');
}

/**
 * Truncates a string to a maximum length with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Extracts a short name from a STAC item ID.
 *
 * @param itemId - The full item ID
 * @param maxLength - Maximum length (default: 30)
 * @returns Shortened name
 */
export function getItemShortName(itemId: string, maxLength: number = 30): string {
  // Remove common prefixes like USGS_LPC_
  let name = itemId.replace(/^USGS_LPC_/, '').replace(/^3DEP_/, '');
  return truncate(name, maxLength);
}

/**
 * Extracts metadata string from a STAC item for display.
 *
 * @param item - STAC item
 * @returns Metadata string (point count and/or date)
 */
export function getItemMetadata(item: {
  properties: {
    datetime?: string | null;
    start_datetime?: string;
    end_datetime?: string;
    'pointcloud:count'?: number;
    'pc:count'?: number;
    [key: string]: unknown;
  };
  bbox?: number[];
}): string {
  const parts: string[] = [];

  // Try to get point count (check both property names)
  const pointCount =
    (item.properties['pc:count'] as number | undefined) ??
    (item.properties['pointcloud:count'] as number | undefined);
  if (pointCount !== undefined && pointCount !== null) {
    parts.push(formatPointCount(pointCount));
  }

  // Try to get datetime (check datetime, start_datetime, end_datetime)
  const datetime =
    item.properties.datetime ||
    item.properties.start_datetime ||
    item.properties.end_datetime;
  if (datetime) {
    try {
      const date = new Date(datetime);
      const year = date.getFullYear();
      if (!isNaN(year)) {
        parts.push(String(year));
      }
    } catch {
      // Ignore date parsing errors
    }
  }

  return parts.length > 0 ? parts.join(' • ') : 'LiDAR Dataset';
}

/**
 * Extracts bounding box from a GeoJSON geometry.
 *
 * @param geometry - GeoJSON geometry
 * @returns Bounding box [west, south, east, north]
 */
export function getBboxFromGeometry(
  geometry: GeoJSON.Geometry
): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  const processCoordinates = (coords: number[]) => {
    minX = Math.min(minX, coords[0]);
    minY = Math.min(minY, coords[1]);
    maxX = Math.max(maxX, coords[0]);
    maxY = Math.max(maxY, coords[1]);
  };

  const traverse = (coords: unknown) => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === 'number') {
        processCoordinates(coords as number[]);
      } else {
        coords.forEach(traverse);
      }
    }
  };

  if ('coordinates' in geometry) {
    traverse(geometry.coordinates);
  }

  return [minX, minY, maxX, maxY];
}
