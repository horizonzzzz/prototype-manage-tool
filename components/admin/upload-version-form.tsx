'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { FileDropzone } from '@/components/file-dropzone';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProductListItem } from '@/lib/types';

import { FormField } from '@/components/admin/form-field';
import type { UploadFormValues } from '@/components/admin/form-schemas';

type UploadVersionFormProps = {
  form: UseFormReturn<UploadFormValues>;
  products: ProductListItem[];
  selectedProductKey?: string;
  selectedUploadFile: File | null;
  uploadError?: string;
  uploading: boolean;
  uploadProgress: number;
  onProductChange: (productKey: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function UploadVersionForm({
  form,
  products,
  selectedProductKey,
  selectedUploadFile,
  uploadError,
  uploading,
  uploadProgress,
  onProductChange,
  onFileChange,
  onSubmit,
}: UploadVersionFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 lg:grid-cols-3">
        <FormField label="产品" required>
          <Select value={selectedProductKey} onValueChange={onProductChange}>
            <SelectTrigger>
              <SelectValue placeholder="请选择产品" />
            </SelectTrigger>
            <SelectContent>
              {products.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.name} ({item.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="版本号" required error={form.formState.errors.version?.message}>
          <Input placeholder="例如 v1.0.0" {...form.register('version')} />
        </FormField>

        <FormField label="版本标题" error={form.formState.errors.title?.message}>
          <Input placeholder="可选" {...form.register('title')} />
        </FormField>
      </div>

      <FormField label="更新说明" error={form.formState.errors.remark?.message}>
        <Textarea rows={3} placeholder="可选" {...form.register('remark')} />
      </FormField>

      <FormField label="源码压缩包" required error={uploadError}>
        <FileDropzone file={selectedUploadFile} onFileChange={onFileChange} disabled={uploading} />
      </FormField>

      {uploading ? <Progress value={uploadProgress} className="h-3" /> : null}
      {uploadError ? (
        <Alert variant="destructive">
          <AlertTitle>上传失败</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={uploading}>
        上传并创建任务
      </Button>
    </form>
  );
}
