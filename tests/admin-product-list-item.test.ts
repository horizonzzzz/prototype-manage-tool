import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { AdminProductListItem } from '@/components/admin-product-list-item';
import type { ProductListItem } from '@/lib/types';

function createProduct(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: 1,
    key: 'dpls-g',
    name: '数据处理日志留存专用系统-集团版超长名称',
    description: null,
    createdAt: '2026-03-23T00:00:00.000Z',
    publishedCount: 3,
    ...overrides,
  };
}

describe('AdminProductListItem', () => {
  test('renders compact admin list item markup with separate key tag and delete action', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminProductListItem, {
        item: createProduct(),
        selected: true,
        onSelect: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toContain('admin-product-list-item');
    expect(markup).toContain('admin-product-list-item-content');
    expect(markup).toContain('admin-product-list-item-main');
    expect(markup).toContain('admin-product-list-item-header');
    expect(markup).toContain('admin-product-list-item-actions');
    expect(markup).toContain('admin-product-list-item-title');
    expect(markup).toContain('admin-product-list-item-title-text');
    expect(markup).toContain('admin-product-list-item-key-tag');
    expect(markup).toContain('数据处理日志留存专用系统-集团版超长名称');
    expect(markup).toContain('dpls-g');
    expect(markup).toContain('3 个已发布版本');
    expect(markup).toContain('删除');
  });
});
