import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { getVersionStatusLabel, isVersionActionEnabled, selectActiveBuildJob } from '@/lib/ui/product-detail-view';

const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const versionListContentSource = readFileSync(new URL('../components/admin/version-list-content.tsx', import.meta.url), 'utf8');

describe('product detail view helpers', () => {
  test("getVersionStatusLabel('published') => '已发布'", () => {
    expect(getVersionStatusLabel('published')).toBe('已发布');
  });

  test("getVersionStatusLabel('running') => '构建中'", () => {
    expect(getVersionStatusLabel('running')).toBe('构建中');
  });

  test("getVersionStatusLabel('failed') => '构建失败'", () => {
    expect(getVersionStatusLabel('failed')).toBe('构建失败');
  });

  test("getVersionStatusLabel('offline') => '已下线'", () => {
    expect(getVersionStatusLabel('offline')).toBe('已下线');
  });

  test("isVersionActionEnabled('setDefault', {status:'published', isDefault:false}) => true", () => {
    expect(isVersionActionEnabled('setDefault', { status: 'published', isDefault: false })).toBe(true);
  });

  test("isVersionActionEnabled('setDefault', {status:'published', isDefault:true}) => false", () => {
    expect(isVersionActionEnabled('setDefault', { status: 'published', isDefault: true })).toBe(false);
  });

  test("isVersionActionEnabled('offline', {status:'offline', isDefault:false}) => false", () => {
    expect(isVersionActionEnabled('offline', { status: 'offline', isDefault: false })).toBe(false);
  });

  test('selectActiveBuildJob chooses running job on initial load when active id is missing', () => {
    const jobs = [
      { id: 11, status: 'failed' },
      { id: 12, status: 'running' },
      { id: 13, status: 'published' },
    ];

    expect(selectActiveBuildJob(jobs, undefined)).toEqual(jobs[1]);
  });

  test('selectActiveBuildJob falls back to active id when no running job exists', () => {
    const jobs = [
      { id: 21, status: 'failed' },
      { id: 22, status: 'published' },
      { id: 23, status: 'offline' },
    ];

    expect(selectActiveBuildJob(jobs, 23)).toEqual(jobs[2]);
  });

  test('selectActiveBuildJob falls back to first job when no running job and no active id match', () => {
    const jobs = [
      { id: 31, status: 'failed' },
      { id: 32, status: 'published' },
    ];

    expect(selectActiveBuildJob(jobs, 99)).toEqual(jobs[0]);
  });

  test('selectActiveBuildJob returns undefined for empty jobs', () => {
    expect(selectActiveBuildJob([], undefined)).toBeUndefined();
  });
});

describe('product detail page source migration', () => {
  test('uses local pagination for versions without rendering the legacy summary strip', () => {
    expect(adminDashboardSource).toContain('const ITEMS_PER_PAGE = 10;');
    expect(adminDashboardSource).toContain('const [versionPage, setVersionPage] = useState(1);');
    expect(adminDashboardSource).toContain('const paginatedVersions = filteredVersions.slice(startIndex, startIndex + ITEMS_PER_PAGE);');
    expect(adminDashboardSource).not.toContain('关键词支持按版本号、标题、备注和状态过滤');
    expect(adminDashboardSource).not.toContain('当前任务版本');
    expect(adminDashboardSource).not.toContain('已发布版本：');
  });

  test('reuses a shared build log dialog for upload follow-up and later log access', () => {
    expect(adminDashboardSource).toContain('setBuildProgressDialogOpen(true);');
    expect(adminDashboardSource).toContain('<BuildHistoryDrawer');
    expect(adminDashboardSource).not.toContain('<BuildProgressDialog');
    expect(adminDashboardSource).toContain('UploadVersionDialog');
    expect(adminDashboardSource).not.toContain('查看进度');
  });

  test('uses the dedicated version list without the title-remark compound column source', () => {
    expect(adminDashboardSource).toContain('VersionListContent');
    expect(versionListContentSource).not.toContain('标题 / 备注');
    expect(versionListContentSource).toContain('disabled={!item.downloadable}');
  });

  test('drops the latest-record tag from each version row to match the prototype table', () => {
    expect(versionListContentSource).not.toContain('version.isLatest');
    expect(versionListContentSource).not.toContain('最新记录');
  });
});
