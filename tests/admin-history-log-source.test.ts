import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');

describe('admin history drawer log loading', () => {
  test('loads persisted build logs for the version history drawer instead of only rendering stage summaries', () => {
    expect(adminDashboardSource).toContain('const [historyJobLog, setHistoryJobLog] = useState<BuildJobLogItem | null>(null);');
    expect(adminDashboardSource).toContain('`/api/build-jobs/${historyActiveJob.id}/logs?step=${logStep}`');
    expect(adminDashboardSource).toContain('const historyTerminalContent = resolveBuildJobTerminalContent(');
    expect(adminDashboardSource).not.toContain(
      "terminalContent={historyActiveJob && historySelectedStep ? buildBuildJobStageText(historyActiveJob, historySelectedStep) : ''}",
    );
  });
});
