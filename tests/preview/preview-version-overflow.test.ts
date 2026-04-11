import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

import type { ProductVersionManifest } from '@/lib/types';
import * as previewDomain from '@/lib/domain/preview';

const previewListSource = readProjectSource('components/preview/preview-product-card.tsx');

function createVersion(version: string, flags?: Partial<Pick<ProductVersionManifest, 'isDefault' | 'isLatest'>>): ProductVersionManifest {
  return {
    version,
    title: null,
    remark: null,
    entryUrl: `/prototypes/crm/${version}/index.html`,
    createdAt: '2024-01-01T00:00:00.000Z',
    isDefault: flags?.isDefault ?? false,
    isLatest: flags?.isLatest ?? false,
  };
}

describe('groupVersionsForPreview', () => {
  test('keeps every version visible when count does not exceed the limit', () => {
    const groupVersionsForPreview =
      previewDomain.groupVersionsForPreview ??
      (() => ({
        visibleVersions: [] as ProductVersionManifest[],
        overflowVersions: [] as ProductVersionManifest[],
      }));

    const versions = [createVersion('v1.0.0', { isDefault: true }), createVersion('v1.1.0', { isLatest: true }), createVersion('v1.2.0')];

    const result = groupVersionsForPreview(versions, 'v1.2.0');

    expect(result.visibleVersions.map((item) => item.version)).toEqual(['v1.0.0', 'v1.1.0', 'v1.2.0']);
    expect(result.overflowVersions).toEqual([]);
  });

  test('keeps original order while prioritizing current, default, and latest versions into the visible set', () => {
    const groupVersionsForPreview =
      previewDomain.groupVersionsForPreview ??
      (() => ({
        visibleVersions: [] as ProductVersionManifest[],
        overflowVersions: [] as ProductVersionManifest[],
      }));

    const versions = [
      createVersion('v1.0.0'),
      createVersion('v1.1.0', { isDefault: true }),
      createVersion('v1.2.0'),
      createVersion('v1.3.0', { isLatest: true }),
      createVersion('v1.4.0'),
      createVersion('v1.5.0'),
    ];

    const result = groupVersionsForPreview(versions, 'v1.4.0');

    expect(result.visibleVersions.map((item) => item.version)).toEqual(['v1.0.0', 'v1.1.0', 'v1.3.0', 'v1.4.0']);
    expect(result.overflowVersions.map((item) => item.version)).toEqual(['v1.2.0', 'v1.5.0']);
  });

  test('does not duplicate versions when current is already the default or latest entry', () => {
    const groupVersionsForPreview =
      previewDomain.groupVersionsForPreview ??
      (() => ({
        visibleVersions: [] as ProductVersionManifest[],
        overflowVersions: [] as ProductVersionManifest[],
      }));

    const versions = [
      createVersion('v1.0.0'),
      createVersion('v1.1.0'),
      createVersion('v1.2.0', { isDefault: true, isLatest: true }),
      createVersion('v1.3.0'),
      createVersion('v1.4.0'),
    ];

    const result = groupVersionsForPreview(versions, 'v1.2.0');

    expect(result.visibleVersions.map((item) => item.version)).toEqual(['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0']);
    expect(result.overflowVersions.map((item) => item.version)).toEqual(['v1.4.0']);
  });
});

describe('preview selector overflow guards', () => {
  test('truncates selected version label inside selector trigger to protect card layout', () => {
    expect(previewListSource).toContain('<SelectValue className="block truncate text-left"');
  });

  test('marks the default version explicitly in selector options', () => {
    expect(previewListSource).toContain('version.isDefault');
    expect(previewListSource).toContain('默认');
  });
});
