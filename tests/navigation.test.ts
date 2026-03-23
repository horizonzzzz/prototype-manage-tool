import { describe, expect, test } from 'vitest';

import { buildAdminHref, buildPreviewHref, resolveAdminProductKey } from '@/lib/ui/navigation';

describe('navigation helpers', () => {
  test('builds preview href without query when no product provided', () => {
    expect(buildPreviewHref(undefined as unknown as string)).toBe('/preview');
  });

  test('builds preview href with product only', () => {
    expect(buildPreviewHref('crm')).toBe('/preview?product=crm');
  });

  test('builds preview href with product and version', () => {
    expect(buildPreviewHref('crm', 'v1.2.0')).toBe('/preview?product=crm&version=v1.2.0');
  });

  test('builds admin href with product', () => {
    expect(buildAdminHref('erp')).toBe('/admin?product=erp');
  });

  test('builds admin href without query when no product provided', () => {
    expect(buildAdminHref()).toBe('/admin');
  });

  test('prefers valid query product key', () => {
    expect(resolveAdminProductKey(['crm', 'erp'], 'erp')).toBe('erp');
  });

  test('falls back to first product when query product key is invalid', () => {
    expect(resolveAdminProductKey(['crm', 'erp'], 'oms')).toBe('crm');
  });

  test('returns undefined when no products exist', () => {
    expect(resolveAdminProductKey([], 'crm')).toBeUndefined();
  });
});
