'use client';

import { AlertCircle } from 'lucide-react';

import { BuildJobStepList } from '@/components/build-job-step-list';
import { BuildJobTerminal } from '@/components/build-job-terminal';
import { StatusChip } from '@/components/status-chip';
import { TerminalShell } from '@/components/terminal-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';

type BuildHistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionLabel: string | null;
  jobs: BuildJobItem[];
  activeJob: BuildJobItem | null;
  activeJobId?: number;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalContent: string;
  onSelectJob: (job: BuildJobItem) => void;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
};

export function BuildHistoryDrawer({
  open,
  onOpenChange,
  versionLabel,
  jobs,
  activeJob,
  activeJobId,
  selectedLogStepKey,
  terminalContent,
  onSelectJob,
  onSelectStep,
}: BuildHistoryDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>版本历史</DrawerTitle>
          <DrawerDescription>
            {versionLabel ? `当前版本：${versionLabel}。仅展示该版本的上传与构建记录。` : '请选择一个版本后查看其构建历史。'}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="grid gap-5 xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]">
          <div className="min-h-0 rounded-[16px] border border-[color:var(--border)] bg-white">
            <div className="border-b border-[color:var(--border)] px-4 py-3 text-sm font-semibold text-slate-900">构建记录</div>
            {jobs.length ? (
              <div className="max-h-[calc(100vh-210px)] space-y-2 overflow-y-auto p-3">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className={`w-full rounded-[14px] border px-4 py-4 text-left transition ${
                      job.id === activeJobId
                        ? 'border-sky-200 bg-sky-50/70 shadow-[0_8px_18px_rgba(14,165,233,0.08)]'
                        : 'border-[color:var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                    onClick={() => onSelectJob(job)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[13px] font-semibold text-slate-900">{job.version}</span>
                      <StatusChip status={job.status} />
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{job.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(job.createdAt)}</div>
                    <div className="mt-3">
                      <Progress value={job.progressPercent} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[240px] items-center justify-center px-6 text-sm text-slate-500">
                {versionLabel ? '该版本暂无构建记录' : '暂无构建记录'}
              </div>
            )}
          </div>

          <div className="min-h-0 space-y-4">
            {activeJob ? (
              <>
                <div className="rounded-[16px] border border-[color:var(--border)] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[14px] font-semibold text-slate-900">{activeJob.version}</span>
                        <StatusChip status={activeJob.status} />
                      </div>
                      <div className="text-sm text-slate-600">{activeJob.fileName}</div>
                      <div className="text-xs text-slate-500">创建时间：{formatDateTime(activeJob.createdAt)}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-500">{activeJob.progressPercent}%</div>
                  </div>
                  <div className="mt-4">
                    <Progress value={activeJob.progressPercent} />
                  </div>
                </div>

                <Alert variant={activeJob.status === 'failed' ? 'destructive' : activeJob.status === 'success' ? 'success' : 'info'}>
                  <AlertTitle>{activeJob.logSummary || '任务执行中'}</AlertTitle>
                  <AlertDescription>{activeJob.errorMessage || `当前步骤：${activeJob.currentStep ?? 'waiting'}`}</AlertDescription>
                </Alert>

                <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
                  <div className="rounded-[16px] border border-[color:var(--border)] bg-white p-3">
                    <BuildJobStepList steps={activeJob.steps} selectedStepKey={selectedLogStepKey} onSelect={onSelectStep} />
                  </div>
                  <TerminalShell badge={selectedLogStepKey ?? activeJob.currentStep ?? 'status'}>
                    <BuildJobTerminal content={terminalContent} emptyText="选择步骤后查看摘要" />
                  </TerminalShell>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                <AlertCircle className="size-5 text-slate-400" />
                选择左侧一条构建记录后查看详情
              </div>
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
