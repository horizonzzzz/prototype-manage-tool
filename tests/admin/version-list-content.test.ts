import { readProjectSource } from '@/tests/support/project-source';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { VersionListContent } from '@/components/admin/panels/version-list-content';
import type { ProductVersionItem } from '@/lib/types';

(globalThis as { React?: typeof React }).React = React;

const versionListContentSource = readProjectSource('components/admin/panels/version-list-content.tsx');

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

describe('VersionListContent', () => {
  test('formats created time as YYYY-MM-DD HH:mm:ss', () => {
    const version = createVersion({ createdAt: '2026-03-27T01:00:00.000Z' });
    const markup = renderToStaticMarkup(
      React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toContain('2026-03-27');
    expect(markup).toContain(':00:00');
    expect(markup).not.toContain('2026-03-27T01:00:00.000Z');
  });

  test('renders the prototype-aligned version table without the title-remark compound column', () => {
    const version = createVersion();
    const markup = renderToStaticMarkup(
      React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).not.toContain('overflow-x-auto');
    expect(markup).not.toContain('min-w-[1120px]');
    expect(markup).toContain('table-fixed');
    expect(markup).not.toContain('标题 / 备注');
    expect(markup).not.toContain('最新记录');
    expect(markup).toContain('flex items-center gap-1');
    expect(markup).not.toContain('设默认');
    expect(markup).not.toContain('下线');
  });

  test('moves secondary version actions into the overflow menu', () => {
    const version = createVersion({ downloadable: true });
    const markup = renderToStaticMarkup(
      React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      }),
    );

    expect(markup).toContain('aria-haspopup="menu"');
    expect(versionListContentSource).toContain('disabled={!item.downloadable}');
    expect(versionListContentSource).toContain('下载源码');
  });

  test('keeps default and offline mutations inside the overflow menu source', () => {
    expect(versionListContentSource).toContain('设为默认');
    expect(versionListContentSource).toContain('下线版本');
    expect(versionListContentSource).toContain('删除版本');
  });
});
