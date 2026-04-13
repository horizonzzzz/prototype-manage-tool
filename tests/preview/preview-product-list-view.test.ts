import { describe, expect, test } from 'vitest';

import { filterPreviewProducts, resolveInitialPreviewVersion } from '@/lib/ui/preview-product-list-view';
import type { ManifestProduct } from '@/lib/types';

const products: ManifestProduct[] = [
  {
    key: 'crm-console',
    name: 'CRM Console',
    description: 'CRM customer journey',
    defaultVersion: '1.0.0',
    createdAt: '2026-04-08T08:00:00.000Z',
    versions: [
      {
        version: '1.0.0',
        title: null,
        remark: null,
        entryUrl: '/prototypes/user-1/crm-console/1.0.0/index.html',
        createdAt: '2026-04-08T08:00:00.000Z',
        isDefault: true,
        isLatest: false,
      },
      {
        version: '1.1.0',
        title: null,
        remark: null,
        entryUrl: '/prototypes/user-1/crm-console/1.1.0/index.html',
        createdAt: '2026-04-09T08:00:00.000Z',
        isDefault: false,
        isLatest: true,
      },
    ],
  },
  {
    key: 'ops-console',
    name: 'Ops Console',
    description: 'Ops dashboard',
    defaultVersion: '2.0.0',
    createdAt: '2026-04-08T09:00:00.000Z',
    versions: [
      {
        version: '2.0.0',
        title: null,
        remark: null,
        entryUrl: '/prototypes/user-1/ops-console/2.0.0/index.html',
        createdAt: '2026-04-08T09:00:00.000Z',
        isDefault: true,
        isLatest: true,
      },
    ],
  },
];

describe('preview product list view helpers', () => {
  test("filterPreviewProducts(products, 'crm') => 1 result", () => {
    expect(filterPreviewProducts(products, 'crm')).toEqual([products[0]]);
  });

  test("filterPreviewProducts(products, 'erp') => 0 results", () => {
    expect(filterPreviewProducts(products, 'erp')).toEqual([]);
  });

  test("resolveInitialPreviewVersion(product, '1.1.0') => '1.1.0'", () => {
    expect(resolveInitialPreviewVersion(products[0], '1.1.0')).toBe('1.1.0');
  });

  test("resolveInitialPreviewVersion(product, '9.9.9') => fallback to default version", () => {
    expect(resolveInitialPreviewVersion(products[0], '9.9.9')).toBe('1.0.0');
  });
});
