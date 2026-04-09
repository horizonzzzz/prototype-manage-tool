import { describe, expect, test } from 'vitest';

import { appNavigationItems, buildAdminHref, buildPreviewHref, resolveAdminProductKey } from '@/lib/ui/navigation';

describe('navigation helpers', () => {
  test('builds preview href without route params when no product provided', () => {
    expect(buildPreviewHref(undefined as unknown as string)).toBe('/preview');
  });

  test('builds preview href with product path segment', () => {
    expect(buildPreviewHref('crm')).toBe('/preview/crm');
  });

  test('builds preview href with product and version path segments', () => {
    expect(buildPreviewHref('crm', 'v1.2.0')).toBe('/preview/crm/v1.2.0');
  });

  test('builds admin href with product path segment', () => {
    expect(buildAdminHref('erp')).toBe('/admin/erp');
  });

  test('builds admin href without route params when no product provided', () => {
    expect(buildAdminHref()).toBe('/admin');
  });

  test('keeps preview navigation active for nested preview routes', () => {
    expect(appNavigationItems[0]?.match('/preview')).toBe(true);
    expect(appNavigationItems[0]?.match('/preview/crm')).toBe(true);
    expect(appNavigationItems[0]?.match('/preview/crm/v1.2.0')).toBe(true);
    expect(appNavigationItems[0]?.match('/admin')).toBe(false);
  });

  test('keeps admin navigation active for nested admin routes', () => {
    expect(appNavigationItems[1]?.match('/admin')).toBe(true);
    expect(appNavigationItems[1]?.match('/admin/erp')).toBe(true);
    expect(appNavigationItems[1]?.match('/preview')).toBe(false);
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
