import { describe, expect, test } from 'vitest';

import { buildLocalizedPreviewStateHref, buildPreviewStateHref, resolvePreviewViewerState } from '@/lib/ui/preview-viewer-state';
import type { ManifestProduct } from '@/lib/types';

function createManifestProduct(overrides: Partial<ManifestProduct> = {}): ManifestProduct {
  return {
    key: 'crm',
    name: 'CRM',
    description: 'CRM customer journey',
    defaultVersion: 'v1.0.0',
    createdAt: '2026-03-27T01:00:00.000Z',
    versions: [
      {
        version: 'v1.0.0',
        title: '首版',
        remark: null,
        entryUrl: '/prototypes/crm/v1.0.0/index.html',
        createdAt: '2026-03-27T01:00:00.000Z',
        isDefault: true,
        isLatest: false,
      },
      {
        version: 'v1.1.0',
        title: '第二版',
        remark: null,
        entryUrl: '/prototypes/crm/v1.1.0/index.html',
        createdAt: '2026-03-28T01:00:00.000Z',
        isDefault: false,
        isLatest: true,
      },
    ],
    ...overrides,
  };
}

describe('preview viewer state helpers', () => {
  test('builds preview list href without query when no viewer target is provided', () => {
    expect(buildPreviewStateHref()).toBe('/preview');
  });

  test('builds preview viewer href with product path and version query state', () => {
    expect(buildPreviewStateHref('crm', 'v1.2.0-beta_1')).toBe('/preview/crm?v=v1.2.0-beta_1');
  });

  test('builds preview viewer href with product path when version is omitted', () => {
    expect(buildPreviewStateHref('crm')).toBe('/preview/crm');
  });

  test('builds localized preview href without a locale prefix for the default zh locale', () => {
    expect(buildLocalizedPreviewStateHref('zh')).toBe('/preview');
    expect(buildLocalizedPreviewStateHref('zh', 'crm', 'v1.2.0-beta_1')).toBe('/preview/crm?v=v1.2.0-beta_1');
  });

  test('builds localized preview href with an /en prefix for the english locale', () => {
    expect(buildLocalizedPreviewStateHref('en')).toBe('/en/preview');
    expect(buildLocalizedPreviewStateHref('en', 'crm', 'v1.2.0-beta_1')).toBe('/en/preview/crm?v=v1.2.0-beta_1');
  });

  test('resolves an exact viewer target when both product and version are valid', () => {
    const state = resolvePreviewViewerState([createManifestProduct()], 'crm', 'v1.1.0');

    expect(state).toEqual({
      isOpen: true,
      productKey: 'crm',
      version: 'v1.1.0',
    });
  });

  test('falls back to the product default version when the requested version is invalid', () => {
    const state = resolvePreviewViewerState([createManifestProduct()], 'crm', 'missing');

    expect(state).toEqual({
      isOpen: true,
      productKey: 'crm',
      version: 'v1.0.0',
    });
  });

  test('returns a closed viewer state when the product key is unknown', () => {
    const state = resolvePreviewViewerState([createManifestProduct()], 'unknown', 'v1.0.0');

    expect(state).toEqual({
      isOpen: false,
      productKey: undefined,
      version: undefined,
    });
  });
});
