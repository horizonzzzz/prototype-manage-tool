import { describe, expect, test } from 'vitest';

import { filterProductsBySearch, paginateProducts } from '@/lib/ui/admin-product-list-view';
import type { ProductListItem } from '@/lib/types';

const products: ProductListItem[] = [
  {
    id: 1,
    key: 'crm-dashboard',
    name: 'CRM Dashboard',
    description: 'CRM customer journey',
    createdAt: '2026-04-08T08:00:00.000Z',
    publishedCount: 2,
  },
  {
    id: 2,
    key: 'risk-platform',
    name: '风控平台',
    description: '企业级平台',
    createdAt: '2026-04-08T09:00:00.000Z',
    publishedCount: 1,
  },
  {
    id: 3,
    key: 'ops-platform',
    name: '运营平台',
    description: '平台运营中心',
    createdAt: '2026-04-08T10:00:00.000Z',
    publishedCount: 3,
  },
];

describe('admin product list view helpers', () => {
  test("filterProductsBySearch(products, 'crm') returns one result", () => {
    expect(filterProductsBySearch(products, 'crm')).toEqual([products[0]]);
  });

  test("filterProductsBySearch(products, '平台') returns two results", () => {
    expect(filterProductsBySearch(products, '平台')).toEqual([products[1], products[2]]);
  });

  test('paginateProducts(products, 1, 1).items returns first product', () => {
    expect(paginateProducts(products, 1, 1).items).toEqual([products[0]]);
  });

  test('paginateProducts(products, 2, 1).items returns second product', () => {
    expect(paginateProducts(products, 2, 1).items).toEqual([products[1]]);
  });
});
