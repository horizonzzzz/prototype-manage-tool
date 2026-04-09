import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('admin dashboard card padding', () => {
  test('uses the standard table page shell plus upload dialog and history drawer in the detail surface', () => {
    expect(dashboardSource).toContain('<StandardTablePage');
    expect(dashboardSource).toContain('tableTitle="版本列表"');
    expect(dashboardSource).toContain('<UploadVersionDialog');
    expect(dashboardSource).toContain('<BuildHistoryDrawer');
  });

  test('does not keep legacy card shell selectors tied to ant design internals', () => {
    expect(dashboardSource).not.toContain('prototype-card');
    expect(globalStyles).not.toContain('.prototype-card');
    expect(globalStyles).not.toContain('.ant-card');
  });
});
