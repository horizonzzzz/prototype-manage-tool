import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { VersionListContent } from '@/components/admin/version-list-content';
import type { ProductDetail, ProductVersionItem } from '@/lib/types';

(globalThis as { React?: typeof React }).React = React;

function createVersion(overrides: Partial<ProductVersionItem> = {}): ProductVersionItem {
  return {
    id: 7,
    version: 'v1.0.0',
    title: 'CRM 首版',
    remark: '包含商机看板',
    entryUrl: '/prototypes/crm/v1.0.0/index.html',
    status: 'published',
    isDefault: false,
    isLatest: true,
    downloadable: true,
    createdAt: '2026-03-27T01:00:00.000Z',
    ...overrides,
  };
}

function createProductDetail(version: ProductVersionItem): ProductDetail {
  return {
    id: 1,
    key: 'crm',
    name: 'CRM',
    description: null,
    createdAt: '2026-03-27T00:00:00.000Z',
    publishedCount: 1,
    versions: [version],
  };
}

describe('VersionListContent', () => {
  test('keeps the download button enabled when the original zip is available', () => {
    const version = createVersion({ downloadable: true });
    const markup = renderToStaticMarkup(
      React.createElement(VersionListContent, {
        versions: [version],
        productDetail: createProductDetail(version),
        onPreview: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toContain('下载');
    expect(markup).toMatch(/<button[^>]*>.*下载/s);
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>.*下载/s);
  });

  test('disables the download button when the original zip is unavailable', () => {
    const version = createVersion({ downloadable: false });
    const markup = renderToStaticMarkup(
      React.createElement(VersionListContent, {
        versions: [version],
        productDetail: createProductDetail(version),
        onPreview: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*下载/s);
  });
});
