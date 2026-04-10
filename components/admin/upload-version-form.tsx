'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { FileDropzone } from '@/components/file-dropzone';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { FormField } from '@/components/admin/form-field';
import type { UploadFormValues } from '@/components/admin/form-schemas';

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
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FormField label="版本号" required error={form.formState.errors.version?.message}>
        <Input placeholder="例如 v1.0.0" {...form.register('version')} />
      </FormField>

      <FormField label="更新说明 (可选)" error={form.formState.errors.remark?.message}>
        <Input placeholder="可选" {...form.register('remark')} />
      </FormField>

      <FormField label="源码压缩包" required error={uploadError}>
        <FileDropzone file={selectedUploadFile} onFileChange={onFileChange} disabled={uploading} />
      </FormField>

      {uploadError ? (
        <Alert variant="destructive">
          <AlertTitle>上传失败</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={uploading}>
          取消
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? '正在上传...' : '开始上传'}
        </Button>
      </div>
    </form>
  );
}
