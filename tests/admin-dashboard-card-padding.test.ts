import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('admin dashboard card padding', () => {
  test('uses a prototype-aligned detail layout instead of the generic standard table page shell', () => {
    expect(dashboardSource).not.toContain('<StandardTablePage');
    expect(dashboardSource).not.toContain('tableTitle="版本列表"');
    expect(dashboardSource).toContain('<UploadVersionDialog');
    expect(dashboardSource).toContain('<BuildHistoryDrawer');
    expect(dashboardSource).not.toContain('<BuildProgressDialog');
    expect(dashboardSource).not.toContain('当前任务版本');
  });

  test('does not keep legacy card shell selectors tied to ant design internals', () => {
    expect(dashboardSource).not.toContain('prototype-card');
    expect(globalStyles).not.toContain('.prototype-card');
    expect(globalStyles).not.toContain('.ant-card');
  });
});
