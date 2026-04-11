import { z } from 'zod';

import { isSafeRouteSegment } from '@/lib/domain/route-segment';

export const uploadFormSchema = z.object({
  version: z.string().trim().min(1, '请输入版本号').refine((value) => isSafeRouteSegment(value), {
    message: '版本号只能包含字母、数字、点、下划线和中划线',
  }),
  title: z.string().optional(),
  remark: z.string().optional(),
});

export const createProductSchema = z.object({
  key: z.string().trim().min(1, '请输入产品 Key'),
  name: z.string().trim().min(1, '请输入产品名称'),
  description: z.string().optional(),
});

export type UploadFormValues = z.infer<typeof uploadFormSchema>;
export type CreateProductFormValues = z.infer<typeof createProductSchema>;
