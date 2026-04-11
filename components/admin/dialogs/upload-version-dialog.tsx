'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { UploadVersionForm } from '@/components/admin/forms/upload-version-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { UploadFormValues } from '@/components/admin/forms/form-schemas';

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
  const t = useTranslations('admin.uploadVersionDialog');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(event) => uploading && event.preventDefault()} onEscapeKeyDown={(event) => uploading && event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
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
