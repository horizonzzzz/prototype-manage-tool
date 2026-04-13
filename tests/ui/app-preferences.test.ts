import { describe, expect, test } from 'vitest';

import {
  APP_THEME_STORAGE_KEY,
  isAuthRoute,
  isWorkspaceRoute,
  normalizeThemePreference,
  getBrowserStorage,
  readThemePreference,
  writeThemePreference,
} from '@/lib/ui/app-preferences';

describe('app preferences', () => {
  test('keeps a stable theme storage key', () => {
    expect(APP_THEME_STORAGE_KEY).toBe('prototype-manage-tool.theme');
  });

  test('normalizes theme preference to supported values', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference(' DARK ')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(normalizeThemePreference(undefined)).toBe('system');
  });

  test('recognizes auth routes', () => {
    expect(isAuthRoute('/login')).toBe(true);
    expect(isAuthRoute('/register')).toBe(true);
    expect(isAuthRoute('/register/confirm')).toBe(true);
    expect(isAuthRoute('/preview')).toBe(false);
    expect(isAuthRoute('/')).toBe(false);
  });

  test('recognizes workspace routes', () => {
    expect(isWorkspaceRoute('/admin')).toBe(true);
    expect(isWorkspaceRoute('/preview/demo/v1')).toBe(true);
    expect(isWorkspaceRoute('/users')).toBe(false);
    expect(isWorkspaceRoute('/settings/profile')).toBe(true);
    expect(isWorkspaceRoute('/login')).toBe(false);
    expect(isWorkspaceRoute('/')).toBe(false);
  });

  test('falls back safely when storage access throws', () => {
    const blockedStorage = {
      getItem() {
        throw new Error('Blocked');
      },
      setItem() {
        throw new Error('Blocked');
      },
    } as unknown as Storage;

    expect(readThemePreference(blockedStorage)).toBe('system');
    expect(writeThemePreference(blockedStorage, 'dark')).toBe(false);
  });

  test('reads and writes theme preferences through a storage provider', () => {
    const storageMap = new Map<string, string>();
    const storageProvider = {
      getItem(key: string) {
        return storageMap.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storageMap.set(key, value);
      },
    } as Storage;

    expect(readThemePreference(storageProvider)).toBe('system');
    expect(writeThemePreference(storageProvider, 'dark')).toBe(true);
    expect(readThemePreference(storageProvider)).toBe('dark');
  });

  test('returns null from browser-storage accessor when storage is unavailable', () => {
    expect(getBrowserStorage(undefined)).toBeNull();

    const throwingStorageTarget = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new Error('Blocked');
      },
    }) as { localStorage: Storage };

    expect(getBrowserStorage(throwingStorageTarget)).toBeNull();
  });
});
