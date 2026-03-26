import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('admin dashboard card padding', () => {
  test('uses the standard card spacing for the version list and recent task sections', () => {
    expect(dashboardSource).toMatch(/className="prototype-card"\s+title="版本列表"/s);
    expect(dashboardSource).toMatch(/className="prototype-card"\s+title="最近任务"/s);
  });

  test('does not keep a tight card variant that strips body padding', () => {
    expect(globalStyles).not.toContain('.prototype-card.prototype-card-tight .ant-card-body');
  });
});
