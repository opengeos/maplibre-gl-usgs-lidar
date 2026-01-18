import type { StacSearchParams, StacSearchResponse, StacItem } from '../core/types';

const PLANETARY_COMPUTER_STAC_API = 'https://planetarycomputer.microsoft.com/api/stac/v1';
const PLANETARY_COMPUTER_SAS_API = 'https://planetarycomputer.microsoft.com/api/sas/v1';
const COLLECTION_ID = '3dep-lidar-copc';

/**
 * Client for searching USGS 3DEP LiDAR COPC data from Microsoft Planetary Computer.
 *
 * @example
 * ```typescript
 * const searcher = new StacSearcher();
 * const results = await searcher.search({
 *   bbox: [-123.1, 44.0, -123.0, 44.1],
 *   limit: 25
 * });
 * ```
 */
export class StacSearcher {
  private _stacUrl: string;
  private _sasUrl: string;
  private _collection: string;
  private _cachedToken: { token: string; expiry: Date } | null = null;

  /**
   * Creates a new StacSearcher instance.
   *
   * @param stacUrl - STAC API base URL (defaults to Planetary Computer)
   * @param sasUrl - SAS token API base URL (defaults to Planetary Computer)
   * @param collection - Collection ID (defaults to 3dep-lidar-copc)
   */
  constructor(
    stacUrl: string = PLANETARY_COMPUTER_STAC_API,
    sasUrl: string = PLANETARY_COMPUTER_SAS_API,
    collection: string = COLLECTION_ID
  ) {
    this._stacUrl = stacUrl;
    this._sasUrl = sasUrl;
    this._collection = collection;
  }

  /**
   * Gets the STAC API base URL.
   */
  get baseUrl(): string {
    return this._stacUrl;
  }

  /**
   * Gets the SAS API base URL.
   */
  get sasUrl(): string {
    return this._sasUrl;
  }

  /**
   * Gets the collection ID.
   */
  get collection(): string {
    return this._collection;
  }

  /**
   * Validates and clamps a bounding box to valid geographic coordinates.
   * Longitude: -180 to 180, Latitude: -90 to 90
   * Also handles NaN and Infinity values.
   *
   * @param bbox - Bounding box [west, south, east, north]
   * @returns Validated and clamped bounding box
   */
  private _validateBbox(
    bbox: [number, number, number, number]
  ): [number, number, number, number] {
    // Replace NaN/Infinity with valid defaults
    const safeValue = (val: number, defaultVal: number, min: number, max: number): number => {
      if (!Number.isFinite(val)) {
        return defaultVal;
      }
      return Math.max(min, Math.min(max, val));
    };

    return [
      safeValue(bbox[0], -180, -180, 180), // west
      safeValue(bbox[1], -90, -90, 90), // south
      safeValue(bbox[2], 180, -180, 180), // east
      safeValue(bbox[3], 90, -90, 90), // north
    ];
  }

  /**
   * Searches the STAC API for items matching the given parameters.
   *
   * @param params - Search parameters (bbox, datetime, limit)
   * @returns Promise resolving to search results
   */
  async search(params: StacSearchParams): Promise<StacSearchResponse> {
    const searchUrl = `${this._stacUrl}/search`;

    // Validate and clamp bbox to valid geographic coordinates to prevent 400 errors
    const validatedParams = { ...params };
    if (validatedParams.bbox) {
      validatedParams.bbox = this._validateBbox(validatedParams.bbox);
    }

    // Planetary Computer API has a max limit of 1000
    if (validatedParams.limit !== undefined && validatedParams.limit > 1000) {
      validatedParams.limit = 1000;
    }

    const body = {
      collections: [this._collection],
      ...validatedParams,
    };

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Try to get more detailed error info
      let errorDetail = '';
      try {
        const errorBody = await response.text();
        errorDetail = ` - ${errorBody}`;
      } catch {
        // Ignore if we can't read the error body
      }
      throw new Error(`STAC search failed: ${response.status} ${response.statusText}${errorDetail}`);
    }

    return response.json();
  }

  /**
   * Searches using bounding box coordinates.
   *
   * @param bounds - Map bounds [west, south, east, north]
   * @param limit - Maximum results (default: 50)
   * @returns Promise resolving to search results
   */
  async searchByExtent(
    bounds: [number, number, number, number],
    limit: number = 50
  ): Promise<StacSearchResponse> {
    return this.search({ bbox: bounds, limit });
  }

  /**
   * Gets a SAS token for the collection.
   * Caches the token and refreshes when expired.
   *
   * @returns Promise resolving to the SAS token
   */
  private async _getSasToken(): Promise<string> {
    // Check if we have a valid cached token (with 5 minute buffer)
    if (this._cachedToken) {
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      if (this._cachedToken.expiry.getTime() - bufferMs > now.getTime()) {
        return this._cachedToken.token;
      }
    }

    // Fetch a new token
    const tokenUrl = `${this._sasUrl}/token/${this._collection}`;
    const response = await fetch(tokenUrl);

    if (!response.ok) {
      throw new Error(`Failed to get SAS token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this._cachedToken = {
      token: data.token,
      expiry: new Date(data['msft:expiry']),
    };

    return this._cachedToken.token;
  }

  /**
   * Gets the COPC asset URL from a STAC item.
   * Signs the URL with a SAS token for Planetary Computer Azure blob access.
   *
   * @param item - STAC item
   * @returns Signed COPC URL
   */
  async getCopcUrl(item: StacItem): Promise<string> {
    const asset = item.assets.data;
    if (!asset) {
      throw new Error(`No data asset found for item ${item.id}`);
    }

    try {
      // Get SAS token and append to URL
      const token = await this._getSasToken();
      const separator = asset.href.includes('?') ? '&' : '?';
      return `${asset.href}${separator}${token}`;
    } catch (error) {
      // Fall back to unsigned URL if SAS token fetch fails
      console.error('Failed to get SAS token, returning unsigned URL:', error);
      return asset.href;
    }
  }

  /**
   * Fetches the next page of results using the 'next' link.
   *
   * @param response - Previous search response
   * @returns Promise resolving to next page of results or null if no more pages
   */
  async fetchNextPage(response: StacSearchResponse): Promise<StacSearchResponse | null> {
    const nextLink = response.links?.find((link) => link.rel === 'next');
    if (!nextLink) {
      return null;
    }

    const res = await fetch(nextLink.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch next page: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Fetches all results by following pagination links.
   * Use with caution as this may return a large number of items.
   *
   * @param params - Search parameters
   * @param maxItems - Maximum total items to fetch (default: 500)
   * @returns Promise resolving to all items
   */
  async searchAll(params: StacSearchParams, maxItems: number = 500): Promise<StacItem[]> {
    const allItems: StacItem[] = [];
    let response = await this.search(params);
    allItems.push(...response.features);

    while (allItems.length < maxItems) {
      const nextResponse = await this.fetchNextPage(response);
      if (!nextResponse || nextResponse.features.length === 0) {
        break;
      }
      allItems.push(...nextResponse.features);
      response = nextResponse;
    }

    return allItems.slice(0, maxItems);
  }

  /**
   * Gets the total number of items matching the search parameters.
   * This performs a search with limit=0 to get just the count.
   *
   * @param params - Search parameters
   * @returns Promise resolving to the total count
   */
  async getCount(params: Omit<StacSearchParams, 'limit'>): Promise<number> {
    const response = await this.search({ ...params, limit: 0 });
    return response.numberMatched ?? response.context?.matched ?? 0;
  }
}
