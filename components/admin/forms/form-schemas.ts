import { z } from 'zod';

import { isSafeRouteSegment } from '@/lib/domain/route-segment';

type Translate = (key: string) => string;

export function createUploadFormSchema(t: Translate) {
  return z.object({
    version: z.string().trim().min(1, t('versionRequired')).refine((value) => isSafeRouteSegment(value), {
      message: t('versionPattern'),
    }),
    title: z.string().optional(),
    remark: z.string().optional(),
  });
}

export function createProductSchema(t: Translate) {
  return z.object({
    key: z.string().trim().min(1, t('keyRequired')),
    name: z.string().trim().min(1, t('nameRequired')),
    description: z.string().optional(),
  });
}

const zhValidationMessages = {
  versionRequired: '请输入版本号',
  versionPattern: '版本号只能包含字母、数字、点、下划线和中划线',
  keyRequired: '请输入产品 Key',
  nameRequired: '请输入产品名称',
} as const;

export const uploadFormSchema = createUploadFormSchema((key) => zhValidationMessages[key as keyof typeof zhValidationMessages]);
export const createProductFormSchema = createProductSchema((key) => zhValidationMessages[key as keyof typeof zhValidationMessages]);

export type UploadFormValues = z.infer<ReturnType<typeof createUploadFormSchema>>;
export type CreateProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;
