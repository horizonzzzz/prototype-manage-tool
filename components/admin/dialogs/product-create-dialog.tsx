'use client';

import type { FormEventHandler } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { FormField } from '@/components/admin/forms/form-field';
import type { CreateProductFormValues } from '@/components/admin/forms/form-schemas';

type ProductCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CreateProductFormValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function ProductCreateDialog({ open, onOpenChange, form, onSubmit }: ProductCreateDialogProps) {
  const t = useTranslations('admin.productCreateDialog');

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
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={onSubmit}>
          <FormField label={t('nameLabel')} required error={form.formState.errors.name?.message}>
            <Input placeholder={t('namePlaceholder')} {...form.register('name')} />
          </FormField>
          <FormField label={t('keyLabel')} required error={form.formState.errors.key?.message}>
            <Input placeholder={t('keyPlaceholder')} {...form.register('key')} />
          </FormField>
          <FormField label={t('descriptionLabel')} error={form.formState.errors.description?.message}>
            <Input placeholder={t('descriptionPlaceholder')} {...form.register('description')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
