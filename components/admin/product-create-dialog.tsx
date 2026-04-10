'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { FormField } from '@/components/admin/form-field';
import type { CreateProductFormValues } from '@/components/admin/form-schemas';

type ProductCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CreateProductFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function ProductCreateDialog({ open, onOpenChange, form, onSubmit }: ProductCreateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          form.reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建产品</DialogTitle>
          <DialogDescription>创建一个新的产品，用于管理其原型版本。</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={onSubmit}>
          <FormField label="产品名称" required error={form.formState.errors.name?.message}>
            <Input placeholder="例如 CRM 系统" {...form.register('name')} />
          </FormField>
          <FormField label="产品 Key" required error={form.formState.errors.key?.message}>
            <Input placeholder="例如 crm" {...form.register('key')} />
          </FormField>
          <FormField label="描述" error={form.formState.errors.description?.message}>
            <Input placeholder="可选" {...form.register('description')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
