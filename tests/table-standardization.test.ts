import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const previewListSource = readFileSync(new URL('../components/preview/preview-product-list.tsx', import.meta.url), 'utf8');
const adminListSource = readFileSync(new URL('../components/admin/admin-product-list.tsx', import.meta.url), 'utf8');
const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const versionListSource = readFileSync(new URL('../components/admin/version-list-content.tsx', import.meta.url), 'utf8');
const historyDrawerSource = readFileSync(new URL('../components/admin/build-history-drawer.tsx', import.meta.url), 'utf8');

describe('table page standardization', () => {
  test('turns the preview list into a standard table page with inline version switching and row actions', () => {
    expect(previewListSource).toContain('<Table');
    expect(previewListSource).toContain('当前版本');
    expect(previewListSource).toContain('搜索产品名称或 Key');
    expect(previewListSource).toContain('<SelectTrigger');
    expect(previewListSource).toContain('复制链接');
    expect(previewListSource).toContain('预览');
    expect(previewListSource).not.toContain('disabled />');
  });

  test('turns the admin product list into a standard table page with detail and delete actions', () => {
    expect(adminListSource).toContain('<Table');
    expect(adminListSource).toContain('搜索产品名称或 Key');
    expect(adminListSource).toContain('详情');
    expect(adminListSource).toContain('删除');
    expect(adminListSource).toContain('创建产品');
  });

  test('moves product detail management to a version table with upload dialog and history drawer', () => {
    expect(adminDashboardSource).toContain('上传版本');
    expect(adminDashboardSource).toContain('Dialog');
    expect(adminDashboardSource).toContain('Drawer');
    expect(adminDashboardSource).not.toContain('最近任务');
    expect(adminDashboardSource).not.toContain("onClick={() => setHistoryDrawerOpen(true)}");
    expect(adminDashboardSource).not.toContain('删除产品');
  });

  test('adds version history to each version row and scopes the drawer to a single version', () => {
    expect(versionListSource).toContain('历史');
    expect(versionListSource).toContain('onHistory');
    expect(historyDrawerSource).toContain('versionLabel');
    expect(historyDrawerSource).toContain('当前版本');
    expect(historyDrawerSource).toContain('该版本暂无可展示的构建过程');
  });
});
