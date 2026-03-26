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
  test('renders an accessible sidebar item with a selected trigger and separate delete action', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminProductListItem, {
        item: createProduct(),
        selected: true,
        onSelect: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-sidebar-item="true"');
    expect(markup).toContain('rounded-[14px]');
    expect(markup).toContain('数据处理日志留存专用系统-集团版超长名称');
    expect(markup).toContain('dpls-g');
    expect(markup).toContain('3 个已发布版本');
    expect(markup).toContain('删除');
    expect(markup).not.toContain('admin-product-list-item-main');
  });
});
