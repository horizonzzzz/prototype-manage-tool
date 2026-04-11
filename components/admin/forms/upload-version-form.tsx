'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { FileDropzone } from '@/components/file-dropzone';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { FormField } from '@/components/admin/forms/form-field';
import type { UploadFormValues } from '@/components/admin/forms/form-schemas';

type UploadVersionFormProps = {
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

export function UploadVersionForm({
  form,
  productName,
  selectedProductKey,
  selectedUploadFile,
  uploadError,
  uploading,
  onCancel,
  onFileChange,
  onSubmit,
}: UploadVersionFormProps) {
  const t = useTranslations('admin.uploadVersionForm');

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FormField label={t('versionLabel')} required error={form.formState.errors.version?.message}>
        <Input placeholder={t('versionPlaceholder')} {...form.register('version')} />
      </FormField>

      <FormField label={t('titleLabel')} error={form.formState.errors.title?.message}>
        <Input placeholder={t('titlePlaceholder')} {...form.register('title')} />
      </FormField>

      <FormField label={t('remarkLabel')} error={form.formState.errors.remark?.message}>
        <Input placeholder={t('remarkPlaceholder')} {...form.register('remark')} />
      </FormField>

      <FormField label={t('fileLabel')} required error={uploadError}>
        <FileDropzone file={selectedUploadFile} onFileChange={onFileChange} disabled={uploading} />
      </FormField>

      {uploadError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('uploadFailed')}</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={uploading}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? t('uploading') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
