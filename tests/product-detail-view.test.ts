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
  test('uses local pagination for filtered versions', () => {
    expect(adminDashboardSource).toContain('const ITEMS_PER_PAGE = 10;');
    expect(adminDashboardSource).toContain('const [versionPage, setVersionPage] = useState(1);');
    expect(adminDashboardSource).toContain('const paginatedVersions = filteredVersions.slice(startIndex, startIndex + ITEMS_PER_PAGE);');
  });

  test('shows active build progress percent with progress bar', () => {
    expect(adminDashboardSource).toContain('activeJobProgress');
    expect(adminDashboardSource).toContain('<Progress');
  });

  test('applies truncation and helper-based action gating in version rows', () => {
    expect(adminDashboardSource).toContain('truncate');
    expect(adminDashboardSource).toContain('VersionListContent');
    expect(adminDashboardSource).toContain('getVersionStatusLabel');
    expect(versionListContentSource).toContain('disabled={!item.downloadable}');
  });

  test('keeps the latest-version indicator in each version row', () => {
    expect(versionListContentSource).toContain('version.isLatest');
    expect(versionListContentSource).toContain('最新记录');
  });
});
