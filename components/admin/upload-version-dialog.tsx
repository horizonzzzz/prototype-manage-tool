'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { CurrentJobContent } from '@/components/admin/current-job-content';
import { UploadVersionForm } from '@/components/admin/upload-version-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { UploadFormValues } from '@/components/admin/form-schemas';
import type { BuildJobItem, BuildJobStepKey } from '@/lib/types';

type UploadVersionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<UploadFormValues>;
  productName?: string;
  selectedProductKey?: string;
  selectedUploadFile: File | null;
  uploadError?: string;
  uploading: boolean;
  uploadProgress: number;
  activeJob: BuildJobItem | null;
  selectedLogStepKey: BuildJobStepKey | null;
  terminalBadge: string;
  terminalContent: string;
  terminalEmptyText: string;
  onFileChange: (file: File | null) => void;
  onSelectStep: (stepKey: BuildJobStepKey) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function UploadVersionDialog({
  open,
  onOpenChange,
  form,
  productName,
  selectedProductKey,
  selectedUploadFile,
  uploadError,
  uploading,
  uploadProgress,
  activeJob,
  selectedLogStepKey,
  terminalBadge,
  terminalContent,
  terminalEmptyText,
  onFileChange,
  onSelectStep,
  onSubmit,
}: UploadVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(94vw,1040px)] max-w-none"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>上传版本</DialogTitle>
          <DialogDescription>填写版本信息并上传源码压缩包，任务创建后会在当前弹窗内持续展示构建进度。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-6 overflow-y-auto pr-1">
          <UploadVersionForm
            form={form}
            productName={productName}
            selectedProductKey={selectedProductKey}
            selectedUploadFile={selectedUploadFile}
            uploadError={uploadError}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onFileChange={onFileChange}
            onSubmit={onSubmit}
          />

          {activeJob ? (
            <div className="rounded-[16px] border border-[color:var(--border)] bg-slate-50/80 p-4">
              <CurrentJobContent
                activeJob={activeJob}
                selectedLogStepKey={selectedLogStepKey}
                terminalBadge={terminalBadge}
                terminalContent={terminalContent}
                terminalEmptyText={terminalEmptyText}
                onSelectStep={onSelectStep}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
