import { BuildJobStepList } from '@/components/build-job-step-list';
import { BuildJobTerminal } from '@/components/build-job-terminal';
import { StatusChip } from '@/components/status-chip';
import { TerminalShell } from '@/components/terminal-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';

type CurrentJobContentProps = {
  activeJob: BuildJobItem | null;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalBadge: string;
  terminalContent: string;
  terminalEmptyText: string;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
};

export function CurrentJobContent({
  activeJob,
  selectedLogStepKey,
  terminalBadge,
  terminalContent,
  terminalEmptyText,
  onSelectStep,
}: CurrentJobContentProps) {
  if (!activeJob) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-[18px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-4 text-sm text-slate-500">
        当前没有正在跟踪的任务
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">当前任务:</span>
            <span className="font-mono text-[13px] text-slate-600">
              {activeJob.version} / {activeJob.fileName}
            </span>
            <StatusChip status={activeJob.status} />
          </div>
          <div className="text-xs text-slate-500">{activeJob.progressPercent}%</div>
        </div>
      </div>

      <Progress
        value={activeJob.progressPercent}
        indicatorClassName={activeJob.status === 'failed' ? 'bg-rose-500' : undefined}
      />

      <Alert variant={activeJob.status === 'failed' ? 'destructive' : activeJob.status === 'success' ? 'success' : 'info'}>
        <AlertTitle>{activeJob.logSummary || '任务执行中'}</AlertTitle>
        <AlertDescription>{activeJob.errorMessage || `当前步骤：${activeJob.currentStep ?? 'waiting'}`}</AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <BuildJobStepList steps={activeJob.steps} selectedStepKey={selectedLogStepKey} onSelect={onSelectStep} />
        <TerminalShell badge={terminalBadge}>
          <BuildJobTerminal content={terminalContent} emptyText={terminalEmptyText} />
        </TerminalShell>
      </div>
    </div>
  );
}
