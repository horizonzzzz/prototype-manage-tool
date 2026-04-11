'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BuildJobStepList } from '@/components/build-job-step-list';
import { BuildJobTerminal } from '@/components/build-job-terminal';
import { TerminalShell } from '@/components/terminal-shell';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';

type BuildHistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionLabel: string | null;
  activeJob: BuildJobItem | null;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalBadge: string;
  terminalContent: string;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
};

export function BuildHistoryDrawer({
  open,
  onOpenChange,
  versionLabel,
  activeJob,
  selectedLogStepKey,
  terminalBadge,
  terminalContent,
  onSelectStep,
}: BuildHistoryDrawerProps) {
  const t = useTranslations('buildHistory');
  const shouldShowProgress = activeJob ? ['queued', 'running', 'building'].includes(activeJob.status) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{versionLabel ? t('titleWithVersion', { version: versionLabel }) : t('title')}</DialogTitle>
          <DialogDescription>{versionLabel ? t('description') : t('emptyDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {shouldShowProgress ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('progress')}</span>
                <span className="font-medium">{activeJob?.progressPercent ?? 0}%</span>
              </div>
              <Progress value={activeJob?.progressPercent ?? 0} />
            </div>
          ) : null}

          {activeJob ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
              <div className="rounded-[16px] border border-[color:var(--border)] bg-white p-3">
                <BuildJobStepList steps={activeJob.steps} selectedStepKey={selectedLogStepKey} onSelect={onSelectStep} />
              </div>
              <TerminalShell badge={terminalBadge}>
                <BuildJobTerminal content={terminalContent} emptyText={t('selectStep')} />
              </TerminalShell>
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-6 text-center text-sm text-slate-500">
              <AlertCircle className="size-5 text-slate-400" />
              {versionLabel ? t('noHistoryForVersion') : t('noHistory')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
