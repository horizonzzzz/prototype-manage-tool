import { isWorkspaceNavigationRoute } from '@/lib/ui/navigation';

export const APP_THEME_STORAGE_KEY = 'prototype-manage-tool.theme';

export type AppTheme = 'light' | 'dark' | 'system';
export type StorageProvider = Pick<Storage, 'getItem' | 'setItem'>;

const authRoutePrefixes = ['/login', '/register'] as const;

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeThemePreference(preference: string | null | undefined): AppTheme {
  if (typeof preference !== 'string') {
    return 'system';
  }

  const value = preference.trim().toLowerCase();
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value;
  }

  return 'system';
}

function safeGetStorageValue(storage: StorageProvider | null | undefined, key: string): string | null {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageValue(storage: StorageProvider | null | undefined, key: string, value: string) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getBrowserStorage(storageTarget?: { localStorage?: StorageProvider }) {
  const target = storageTarget ?? (typeof window === 'undefined' ? undefined : window);

  if (!target) {
    return null;
  }

  try {
    return target.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readThemePreference(storage?: StorageProvider | null) {
  return normalizeThemePreference(safeGetStorageValue(storage, APP_THEME_STORAGE_KEY));
}

export function writeThemePreference(storage: StorageProvider | null | undefined, theme: AppTheme) {
  return safeSetStorageValue(storage, APP_THEME_STORAGE_KEY, theme);
}

export function isAuthRoute(pathname: string) {
  return authRoutePrefixes.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

export function isWorkspaceRoute(pathname: string) {
  return isWorkspaceNavigationRoute(pathname);
}
