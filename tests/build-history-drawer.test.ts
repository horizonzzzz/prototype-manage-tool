import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const historyDrawerSource = readFileSync(new URL('../components/admin/build-history-drawer.tsx', import.meta.url), 'utf8');

describe('BuildHistoryDrawer source', () => {
  test('removes the build record list and keeps only the process area', () => {
    expect(historyDrawerSource).not.toContain('构建记录');
    expect(historyDrawerSource).not.toContain('jobs.map');
    expect(historyDrawerSource).not.toContain('onSelectJob');
    expect(historyDrawerSource).toContain('构建日志');
    expect(historyDrawerSource).toContain('构建进度');
    expect(historyDrawerSource).toContain('BuildJobStepList');
    expect(historyDrawerSource).toContain('BuildJobTerminal');
    expect(historyDrawerSource).not.toContain("from '@/components/ui/alert'");
    expect(historyDrawerSource).toContain('sm:max-w-[800px]');
  });
});
