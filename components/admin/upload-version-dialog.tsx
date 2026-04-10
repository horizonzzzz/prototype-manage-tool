'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { UploadVersionForm } from '@/components/admin/upload-version-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { UploadFormValues } from '@/components/admin/form-schemas';

type UploadVersionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<UploadFormValues>;
  productName?: string;
  selectedProductKey?: string;
  selectedUploadFile: File | null;
  uploadError?: string;
  uploading: boolean;
  onCancel: () => void;
  onFileChange: (file: File | null) => void;
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
  onCancel,
  onFileChange,
  onSubmit,
}: UploadVersionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(94vw,720px)] max-w-none"
        onInteractOutside={(event) => uploading && event.preventDefault()}
        onEscapeKeyDown={(event) => uploading && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>上传版本</DialogTitle>
          <DialogDescription>填写版本信息并上传源码压缩包。创建成功后会在单独的弹窗中展示任务状态和日志。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <UploadVersionForm
            form={form}
            productName={productName}
            selectedProductKey={selectedProductKey}
            selectedUploadFile={selectedUploadFile}
            uploadError={uploadError}
            uploading={uploading}
            onCancel={onCancel}
            onFileChange={onFileChange}
            onSubmit={onSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
