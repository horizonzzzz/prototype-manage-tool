import { describe, expect, test } from 'vitest';

import { ApiClientError } from '@/lib/ui/api-client';
import { resolveProductDetailLoadFailure } from '@/lib/ui/product-detail-load-state';

describe('product detail load failure handling', () => {
  test('treats a 404 detail request as a missing product state', () => {
    expect(resolveProductDetailLoadFailure(new ApiClientError('Product not found', 404), '加载产品详情失败')).toEqual({
      productMissing: true,
      message: 'Product not found',
    });
  });

  test('treats non-404 failures as retryable load errors', () => {
    expect(resolveProductDetailLoadFailure(new ApiClientError('Build jobs unavailable', 500), '加载产品详情失败')).toEqual({
      productMissing: false,
      message: 'Build jobs unavailable',
    });
  });

  test('falls back to the provided message for unknown errors', () => {
    expect(resolveProductDetailLoadFailure(null, '加载产品详情失败')).toEqual({
      productMissing: false,
      message: '加载产品详情失败',
    });
  });
});
