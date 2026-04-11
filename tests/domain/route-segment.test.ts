import { describe, expect, test } from 'vitest';

import { assertSafeRouteSegment, isSafeRouteSegment } from '@/lib/domain/route-segment';

describe('route segment safety', () => {
  test('accepts route-safe segments', () => {
    expect(isSafeRouteSegment('v1.2.0-beta_1')).toBe(true);
    expect(assertSafeRouteSegment('crm', 'product key')).toBe('crm');
  });

  test('rejects unsafe route segments', () => {
    expect(isSafeRouteSegment('release/1')).toBe(false);
    expect(isSafeRouteSegment('release candidate')).toBe(false);
    expect(() => assertSafeRouteSegment('../crm', 'product key')).toThrow('Invalid product key');
  });
});
