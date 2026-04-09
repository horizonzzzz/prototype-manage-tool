'use client';

import { AlertCircle } from 'lucide-react';

import { BuildJobStepList } from '@/components/build-job-step-list';
import { BuildJobTerminal } from '@/components/build-job-terminal';
import { TerminalShell } from '@/components/terminal-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';

type BuildHistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionLabel: string | null;
  activeJob: BuildJobItem | null;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalContent: string;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
};

export function BuildHistoryDrawer({
  open,
  onOpenChange,
  versionLabel,
  activeJob,
  selectedLogStepKey,
  terminalContent,
  onSelectStep,
}: BuildHistoryDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>构建历史</DrawerTitle>
          <DrawerDescription>
            {versionLabel ? `当前版本：${versionLabel}。仅展示该版本的构建过程。` : '请选择一个版本后查看其构建过程。'}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="min-h-0">
          <div className="min-h-0 space-y-4">
            {activeJob ? (
              <>
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
                {versionLabel ? '该版本暂无可展示的构建过程' : '暂无可展示的构建过程'}
              </div>
            )}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
