import { describe, expect, it, vi } from 'vitest';
import { bboxAreaSquareMiles, requestEptCopcClip } from '../src/lib/export';
import type { EptFeature, UnifiedSearchItem } from '../src/lib/core/types';

function eptItem(id = 'survey-a'): UnifiedSearchItem {
  const url = `https://example.com/${id}/ept.json`;
  const originalItem: EptFeature = {
    type: 'Feature',
    properties: { name: id, count: 100, url },
    geometry: { type: 'Polygon', coordinates: [] },
  };
  return {
    id,
    type: 'Feature',
    geometry: originalItem.geometry,
    bbox: [-84.13, 35.67, -84.129, 35.671],
    properties: { name: id, url },
    sourceType: 'ept',
    originalItem,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('EPT COPC clip service', () => {
  it('calculates a small bounding box area', () => {
    expect(bboxAreaSquareMiles([-84.13, 35.67, -84.129, 35.671])).toBeCloseTo(0.00386, 4);
  });

  it('submits, polls, and returns a COPC download', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: true,
            data: { order_token: 'token-1', status: 'queued' },
          },
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            order_token: 'token-1',
            status: 'completed',
            output_files: [{ filename: 'clip.copc.laz' }],
          },
        })
      );

    const result = await requestEptCopcClip([eptItem()], [-84.13, 35.67, -84.129, 35.671], {
      fetch: fetcher,
      serviceUrl: 'https://clips.example/',
      pollIntervalMs: 0,
    });

    expect(result).toEqual({
      filename: 'clip.copc.laz',
      downloadUrl: 'https://clips.example/download/token-1/clip.copc.laz',
    });
    expect(fetcher.mock.calls[1][0]).toBe('https://clips.example/api/orders/token-1/status');
    expect(fetcher.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
    const submit = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(submit.processing_options.output_format).toBe('copc_laz');
    expect(submit.pdal_pipeline[0]).toMatchObject({
      type: 'readers.ept',
      filename: 'https://example.com/survey-a/ept.json',
      polygon:
        'POLYGON((-84.13 35.67, -84.129 35.67, -84.129 35.671, -84.13 35.671, -84.13 35.67))/EPSG:4326',
    });
  });

  it('aborts a hanging submission when the operation times out', async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );

    await expect(
      requestEptCopcClip([eptItem()], [-84.13, 35.67, -84.129, 35.671], {
        fetch: fetcher,
        timeoutMs: 5,
      })
    ).rejects.toThrow('COPC export timed out');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects requests above the service area limit', async () => {
    await expect(requestEptCopcClip([eptItem()], [-84.2, 35.6, -84, 35.8])).rejects.toThrow(
      'limited to 5 square miles'
    );
  });
});
