import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StacSearcher } from '../src/lib/stac/StacSearcher';

describe('StacSearcher', () => {
  let searcher: StacSearcher;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    searcher = new StacSearcher();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default Planetary Computer API URL', () => {
      expect(searcher.baseUrl).toBe('https://planetarycomputer.microsoft.com/api/stac/v1');
    });

    it('should use default 3dep-lidar-copc collection', () => {
      expect(searcher.collection).toBe('3dep-lidar-copc');
    });

    it('should accept custom base URL and collection', () => {
      const customSearcher = new StacSearcher('https://custom.api', 'https://custom.sas', 'custom-collection');
      expect(customSearcher.baseUrl).toBe('https://custom.api');
      expect(customSearcher.collection).toBe('custom-collection');
    });
  });

  describe('search', () => {
    it('should make POST request to search endpoint', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await searcher.search({ bbox: [-123, 44, -122, 45], limit: 10 });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://planetarycomputer.microsoft.com/api/stac/v1/search',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(searcher.search({ bbox: [-123, 44, -122, 45] })).rejects.toThrow(
        'STAC search failed: 500 Internal Server Error'
      );
    });
  });

  describe('searchByExtent', () => {
    it('should call search with bbox and limit', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [{ id: 'item-1' }],
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await searcher.searchByExtent([-123, 44, -122, 45], 25);

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(callBody.bbox).toEqual([-123, 44, -122, 45]);
      expect(callBody.limit).toBe(25);
      expect(callBody.collections).toEqual(['3dep-lidar-copc']);
    });
  });

  describe('getCopcUrl', () => {
    it('should return signed URL when signing succeeds', async () => {
      const item = {
        id: 'test-item',
        assets: {
          data: { href: 'https://storage.blob.core.windows.net/data/file.copc.laz' },
        },
      };

      // Mock the SAS token endpoint response
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          token: 'sig=xxx',
          'msft:expiry': new Date(Date.now() + 3600000).toISOString()
        }),
      } as Response);

      const url = await searcher.getCopcUrl(item as any);
      expect(url).toBe('https://storage.blob.core.windows.net/data/file.copc.laz?sig=xxx');
    });

    it('should return unsigned URL when signing fails', async () => {
      const item = {
        id: 'test-item',
        assets: {
          data: { href: 'https://storage.blob.core.windows.net/data/file.copc.laz' },
        },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const url = await searcher.getCopcUrl(item as any);
      expect(url).toBe('https://storage.blob.core.windows.net/data/file.copc.laz');
    });

    it('should throw error when no data asset exists', async () => {
      const item = {
        id: 'test-item',
        assets: {},
      };

      await expect(searcher.getCopcUrl(item as any)).rejects.toThrow(
        'No data asset found for item test-item'
      );
    });
  });
});
