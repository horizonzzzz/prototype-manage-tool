'use client';

import { CurrentJobContent } from '@/components/admin/current-job-content';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';

type BuildProgressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeJob: BuildJobItem | null;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalBadge: string;
  terminalContent: string;
  terminalEmptyText: string;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
};

export function BuildProgressDialog({
  open,
  onOpenChange,
  activeJob,
  selectedLogStepKey,
  terminalBadge,
  terminalContent,
  terminalEmptyText,
  onSelectStep,
}: BuildProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,1040px)] max-w-none">
        <DialogHeader>
          <DialogTitle>构建进度</DialogTitle>
          <DialogDescription>
            {activeJob ? `版本 ${activeJob.version} 已开始执行构建与发布流程。` : '当前没有可展示的构建任务。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <CurrentJobContent
            activeJob={activeJob}
            selectedLogStepKey={selectedLogStepKey}
            terminalBadge={terminalBadge}
            terminalContent={terminalContent}
            terminalEmptyText={terminalEmptyText}
            onSelectStep={onSelectStep}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
