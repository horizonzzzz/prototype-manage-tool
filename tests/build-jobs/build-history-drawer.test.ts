import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const historyDrawerSource = readProjectSource('components/admin/dialogs/build-history-drawer.tsx');

describe('BuildHistoryDrawer source', () => {
  test('removes the build record list and keeps only the process area', () => {
    expect(historyDrawerSource).not.toContain('构建记录');
    expect(historyDrawerSource).not.toContain('jobs.map');
    expect(historyDrawerSource).not.toContain('onSelectJob');
    expect(historyDrawerSource).toContain("useTranslations('buildHistory')");
    expect(historyDrawerSource).toContain("t('title')");
    expect(historyDrawerSource).toContain("t('progress')");
    expect(historyDrawerSource).toContain('BuildJobStepList');
    expect(historyDrawerSource).toContain('BuildJobTerminal');
    expect(historyDrawerSource).not.toContain("from '@/components/ui/alert'");
    expect(historyDrawerSource).toContain('sm:max-w-[800px]');
  });
});
