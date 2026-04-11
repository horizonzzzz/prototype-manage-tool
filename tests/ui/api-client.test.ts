import { afterEach, describe, expect, test, vi } from 'vitest';

import { ApiClientError, fetchJson, isApiClientError } from '@/lib/ui/api-client';

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('throws an ApiClientError with status and message for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          message: 'Product not found',
        }),
      }),
    );

    await expect(fetchJson('/api/products/crm')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Product not found',
      status: 404,
    });
  });

  test('throws an ApiClientError when the response payload marks the request unsuccessful', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          message: 'Build jobs unavailable',
        }),
      }),
    );

    await expect(fetchJson('/api/products/crm/build-jobs')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Build jobs unavailable',
      status: 200,
    });
  });

  test('identifies ApiClientError instances reliably', () => {
    expect(isApiClientError(new ApiClientError('failed', 500))).toBe(true);
    expect(isApiClientError(new Error('failed'))).toBe(false);
  });
});
