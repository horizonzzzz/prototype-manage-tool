import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('admin dashboard card padding', () => {
  test('uses the shared panel card wrapper for the version list and recent task sections', () => {
    expect(dashboardSource).toMatch(/<PanelCard[^>]+title="版本列表"/s);
    expect(dashboardSource).toMatch(/<PanelCard[^>]+title="最近任务"/s);
  });

  test('does not keep legacy card shell selectors tied to ant design internals', () => {
    expect(dashboardSource).not.toContain('prototype-card');
    expect(globalStyles).not.toContain('.prototype-card');
    expect(globalStyles).not.toContain('.ant-card');
  });
});
