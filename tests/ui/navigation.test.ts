import { describe, expect, test } from 'vitest';

import {
  appNavigationItems,
  buildAdminHref,
  buildPreviewHref,
  isWorkspaceNavigationRoute,
  resolveAdminProductKey,
  workspaceRouteHrefs,
} from '@/lib/ui/navigation';

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

  test('includes admin, preview, users, mcp, and settings navigation entries', () => {
    expect(appNavigationItems.map((item) => item.href)).toEqual(['/admin', '/preview', '/users', '/mcp', '/settings']);
  });

  test('exposes workspace route hrefs from the same navigation source-of-truth', () => {
    expect(workspaceRouteHrefs).toEqual(appNavigationItems.map((item) => item.href));
  });

  test('keeps preview navigation active for nested preview routes', () => {
    const previewNavigation = appNavigationItems.find((item) => item.href === '/preview');

    expect(previewNavigation?.match('/preview')).toBe(true);
    expect(previewNavigation?.match('/preview/crm')).toBe(true);
    expect(previewNavigation?.match('/preview/crm/v1.2.0')).toBe(true);
    expect(previewNavigation?.match('/admin')).toBe(false);
  });

  test('keeps admin navigation active for nested admin routes', () => {
    const adminNavigation = appNavigationItems.find((item) => item.href === '/admin');

    expect(adminNavigation?.match('/admin')).toBe(true);
    expect(adminNavigation?.match('/admin/erp')).toBe(true);
    expect(adminNavigation?.match('/preview')).toBe(false);
  });

  test('keeps users, mcp, and settings navigation active for nested routes', () => {
    const usersNavigation = appNavigationItems.find((item) => item.href === '/users');
    const mcpNavigation = appNavigationItems.find((item) => item.href === '/mcp');
    const settingsNavigation = appNavigationItems.find((item) => item.href === '/settings');

    expect(usersNavigation?.match('/users')).toBe(true);
    expect(usersNavigation?.match('/users/list')).toBe(true);
    expect(usersNavigation?.match('/settings')).toBe(false);
    expect(usersNavigation?.match('/mcp')).toBe(false);

    expect(mcpNavigation?.match('/mcp')).toBe(true);
    expect(mcpNavigation?.match('/mcp/tokens')).toBe(true);
    expect(mcpNavigation?.match('/settings')).toBe(false);

    expect(settingsNavigation?.match('/settings')).toBe(true);
    expect(settingsNavigation?.match('/settings/profile')).toBe(true);
    expect(settingsNavigation?.match('/users')).toBe(false);
    expect(settingsNavigation?.match('/mcp')).toBe(false);
  });

  test('provides a shared workspace-route matcher based on navigation entries', () => {
    expect(isWorkspaceNavigationRoute('/admin')).toBe(true);
    expect(isWorkspaceNavigationRoute('/preview/demo/v1')).toBe(true);
    expect(isWorkspaceNavigationRoute('/users/list')).toBe(true);
    expect(isWorkspaceNavigationRoute('/mcp/tokens')).toBe(true);
    expect(isWorkspaceNavigationRoute('/settings/profile')).toBe(true);
    expect(isWorkspaceNavigationRoute('/login')).toBe(false);
    expect(isWorkspaceNavigationRoute('/register')).toBe(false);
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
