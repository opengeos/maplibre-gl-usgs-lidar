import * as topojson from 'topojson-client';
import type { EptFeature, EptSearchResponse, CacheEntry } from '../core/types';

const DEFAULT_EPT_BOUNDARY_URL =
  'https://raw.githubusercontent.com/hobuinc/usgs-lidar/master/boundaries/boundaries.topojson';
const CACHE_KEY = 'usgs-lidar-ept-boundaries';
const DEFAULT_CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Client for searching USGS 3DEP LiDAR EPT data from hobuinc/usgs-lidar boundaries.
 *
 * @example
 * ```typescript
 * const searcher = new EptSearcher();
 * const results = await searcher.searchByExtent(
 *   [-123.1, 44.0, -123.0, 44.1],
 *   25
 * );
 * ```
 */
export class EptSearcher {
  private _boundaryUrl: string;
  private _cacheDuration: number;
  private _features: EptFeature[] | null = null;
  private _loadPromise: Promise<EptFeature[]> | null = null;

  /**
   * Creates a new EptSearcher instance.
   *
   * @param boundaryUrl - URL to the TopoJSON boundaries file
   * @param cacheDuration - Cache duration in milliseconds
   */
  constructor(
    boundaryUrl: string = DEFAULT_EPT_BOUNDARY_URL,
    cacheDuration: number = DEFAULT_CACHE_DURATION
  ) {
    this._boundaryUrl = boundaryUrl;
    this._cacheDuration = cacheDuration;
  }

  /**
   * Gets the boundary URL.
   */
  get boundaryUrl(): string {
    return this._boundaryUrl;
  }

  /**
   * Loads and caches the EPT boundaries from TopoJSON.
   *
   * @returns Promise resolving to EPT features
   */
  private async _loadBoundaries(): Promise<EptFeature[]> {
    // Check localStorage cache first
    const cached = this._getFromCache();
    if (cached) {
      return cached;
    }

    // Fetch from URL
    const response = await fetch(this._boundaryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPT boundaries: ${response.status} ${response.statusText}`);
    }

    const topoData = await response.json();

    // Convert TopoJSON to GeoJSON features
    // The TopoJSON has an object key - typically 'boundaries' or similar
    const objectKey = Object.keys(topoData.objects)[0];
    const geojsonResult = topojson.feature(topoData, topoData.objects[objectKey]);
    // topojson.feature can return either a Feature or FeatureCollection depending on input
    // We need to handle both cases
    const geojson: GeoJSON.FeatureCollection =
      'features' in geojsonResult
        ? (geojsonResult as unknown as GeoJSON.FeatureCollection)
        : { type: 'FeatureCollection', features: [geojsonResult as unknown as GeoJSON.Feature] };

    const features: EptFeature[] = geojson.features.map((f) => ({
      type: 'Feature' as const,
      properties: {
        name: (f.properties?.name as string) ?? 'Unknown',
        count: (f.properties?.count as number) ?? 0,
        url: (f.properties?.url as string) ?? '',
      },
      geometry: f.geometry,
      bbox: this._computeBbox(f.geometry),
    }));

    // Cache the result
    this._saveToCache(features);

    return features;
  }

  /**
   * Computes bounding box from geometry.
   */
  private _computeBbox(geometry: GeoJSON.Geometry): [number, number, number, number] {
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    const processCoord = (coord: number[]) => {
      minX = Math.min(minX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxX = Math.max(maxX, coord[0]);
      maxY = Math.max(maxY, coord[1]);
    };

    const traverse = (coords: unknown) => {
      if (Array.isArray(coords)) {
        if (typeof coords[0] === 'number') {
          processCoord(coords as number[]);
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

  /**
   * Gets cached boundaries from localStorage.
   */
  private _getFromCache(): EptFeature[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const entry: CacheEntry<EptFeature[]> = JSON.parse(cached);
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Saves boundaries to localStorage cache.
   */
  private _saveToCache(features: EptFeature[]): void {
    try {
      const entry: CacheEntry<EptFeature[]> = {
        data: features,
        timestamp: Date.now(),
        expiresAt: Date.now() + this._cacheDuration,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to cache EPT boundaries:', error);
    }
  }

  /**
   * Clears the cached boundaries.
   */
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore localStorage errors
    }
    this._features = null;
  }

  /**
   * Ensures boundaries are loaded (with deduplication).
   */
  private async _ensureLoaded(): Promise<EptFeature[]> {
    if (this._features) {
      return this._features;
    }

    if (!this._loadPromise) {
      this._loadPromise = this._loadBoundaries().then((features) => {
        this._features = features;
        this._loadPromise = null;
        return features;
      });
    }

    return this._loadPromise;
  }

  /**
   * Searches EPT boundaries by bounding box.
   *
   * @param bbox - Bounding box [west, south, east, north]
   * @param limit - Maximum results (default: 50)
   * @returns Promise resolving to search results
   */
  async searchByExtent(
    bbox: [number, number, number, number],
    limit: number = 50
  ): Promise<EptSearchResponse> {
    const features = await this._ensureLoaded();

    // Filter features that intersect with bbox
    const [west, south, east, north] = bbox;
    const matching = features.filter((f) => {
      if (!f.bbox) return false;
      const [fWest, fSouth, fEast, fNorth] = f.bbox;
      // Check for bbox intersection
      return !(fEast < west || fWest > east || fNorth < south || fSouth > north);
    });

    // Sort by point count (descending) and limit
    const sorted = matching
      .sort((a, b) => (b.properties.count ?? 0) - (a.properties.count ?? 0))
      .slice(0, limit);

    return {
      type: 'FeatureCollection',
      features: sorted,
      numberMatched: matching.length,
    };
  }

  /**
   * Gets the EPT URL for a feature.
   *
   * @param feature - EPT feature
   * @returns EPT URL (direct, no signing needed)
   */
  getEptUrl(feature: EptFeature): string {
    return feature.properties.url;
  }

  /**
   * Gets all available EPT resources.
   *
   * @returns Promise resolving to all EPT features
   */
  async getAllFeatures(): Promise<EptFeature[]> {
    return this._ensureLoaded();
  }

  /**
   * Gets the total count of EPT resources.
   */
  async getCount(): Promise<number> {
    const features = await this._ensureLoaded();
    return features.length;
  }
}
