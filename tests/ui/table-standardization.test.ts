import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const previewListSource = readProjectSource('components/preview/preview-product-list.tsx');
const previewCardSource = readProjectSource('components/preview/preview-product-card.tsx');
const previewEmptyStateSource = readProjectSource('components/preview/preview-empty-state.tsx');
const adminListSource = readProjectSource('components/admin/panels/admin-product-list.tsx');
const adminDashboardSource = readProjectSource('components/admin-dashboard.tsx');
const versionManagementPanelSource = readProjectSource('components/admin/panels/version-management-panel.tsx');
const versionListSource = readProjectSource('components/admin/panels/version-list-content.tsx');
const historyDrawerSource = readProjectSource('components/admin/dialogs/build-history-drawer.tsx');

describe('table page standardization', () => {
  test('turns the preview list into a prototype-aligned card page without the generic standard page wrapper', () => {
    expect(previewListSource).not.toContain('<StandardTablePage');
    expect(previewListSource).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
    expect(previewListSource).toContain('PreviewViewerDialog');
    expect(previewListSource).toContain('buildPreviewStateHref');
    expect(previewListSource).not.toContain('当前版本');
    expect(previewListSource).not.toContain('默认版本：');
    expect(previewListSource).not.toContain('创建时间');
    expect(previewListSource).not.toContain('StatusChip');
    expect(previewListSource).not.toContain('复制链接');
    expect(previewListSource).not.toContain('打开');
    expect(previewListSource).toContain("useTranslations('preview.list')");
    expect(previewListSource).toContain("t('searchPlaceholder')");
    expect(previewCardSource).toContain('<SelectTrigger');
    expect(previewEmptyStateSource).toContain("useTranslations('preview.empty')");
    expect(previewListSource).not.toContain('<Table');
  });

  test('turns the admin product list into a standard table page with detail and delete actions', () => {
    expect(adminListSource).toContain('<Table');
    expect(adminListSource).toContain("useTranslations('admin.productList')");
    expect(adminListSource).toContain("t('searchPlaceholder')");
    expect(adminListSource).toContain("t('detail')");
    expect(adminListSource).toContain("t('delete')");
    expect(adminListSource).toContain("t('create')");
    expect(adminListSource).not.toContain('<StandardTablePage');
  });

  test('moves product detail management to a version table with upload dialog and history drawer', () => {
    expect(versionManagementPanelSource).toContain("useTranslations('admin.versionManagement')");
    expect(versionManagementPanelSource).toContain("t('upload')");
    expect(adminDashboardSource).toContain('UploadVersionDialog');
    expect(adminDashboardSource).toContain('BuildHistoryDrawer');
    expect(adminDashboardSource).not.toContain('<BuildProgressDialog');
    expect(adminDashboardSource).not.toContain('<StandardTablePage');
    expect(adminDashboardSource).not.toContain('最近任务');
    expect(adminDashboardSource).not.toContain('当前任务版本');
    expect(adminDashboardSource).not.toContain('删除产品');
  });

  test('adds version history to each version row and scopes the drawer to a single version', () => {
    expect(versionListSource).toContain("t('history')");
    expect(versionListSource).toContain('onHistory');
    expect(historyDrawerSource).toContain('versionLabel');
    expect(historyDrawerSource).toContain("t('titleWithVersion'");
    expect(historyDrawerSource).toContain("t('noHistoryForVersion')");
    expect(versionListSource).toContain('DropdownMenu');
  });
});
