import { readProjectSource } from '@/tests/support/project-source';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { VersionListContent } from '@/components/admin/panels/version-list-content';
import type { ProductVersionItem } from '@/lib/types';

(globalThis as { React?: typeof React }).React = React;

const versionListContentSource = readProjectSource('components/admin/panels/version-list-content.tsx');
const messages = {
  admin: {
    versionList: {
      columns: {
        version: '版本号',
        status: '状态',
        description: '描述',
        createdAt: '上传时间',
        actions: '操作'
      },
      default: '默认版本',
      notAvailable: '—',
      history: '查看构建日志',
      moreActions: '更多操作 {version}',
      download: '下载源码',
      setDefault: '设为默认',
      offline: '下线版本',
      delete: '删除版本',
      empty: '暂无版本'
    },
    versionStatus: {
      published: '已发布',
      building: '构建中',
      failed: '构建失败',
      offline: '已下线'
    }
  }
};

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
      React.createElement(NextIntlClientProvider, { locale: 'zh', messages }, React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      })),
    );

    expect(markup).toContain('2026-03-27');
    expect(markup).toContain(':00:00');
    expect(markup).not.toContain('2026-03-27T01:00:00.000Z');
  });

  test('renders the prototype-aligned version table without the title-remark compound column', () => {
    const version = createVersion();
    const markup = renderToStaticMarkup(
      React.createElement(NextIntlClientProvider, { locale: 'zh', messages }, React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      })),
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
      React.createElement(NextIntlClientProvider, { locale: 'zh', messages }, React.createElement(VersionListContent, {
        versions: [version],
        onHistory: () => undefined,
        onDownload: () => undefined,
        onSetDefault: () => undefined,
        onOffline: () => undefined,
        onDelete: () => undefined,
      })),
    );

    expect(markup).toContain('aria-haspopup="menu"');
    expect(versionListContentSource).toContain('disabled={!item.downloadable}');
    expect(versionListContentSource).toContain("t('download')");
  });

  test('keeps default and offline mutations inside the overflow menu source', () => {
    expect(versionListContentSource).toContain("t('setDefault')");
    expect(versionListContentSource).toContain("t('offline')");
    expect(versionListContentSource).toContain("t('delete')");
  });
});
