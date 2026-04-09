import { describe, expect, test } from 'vitest';

import { uploadFormSchema } from '@/components/admin/form-schemas';

describe('upload form schema', () => {
  test('accepts route-safe version segments', () => {
    const result = uploadFormSchema.safeParse({ version: 'v1.2.0-beta_1', title: '', remark: '' });
    expect(result.success).toBe(true);
  });

  test('rejects version values that cannot safely be used as route segments', () => {
    const result = uploadFormSchema.safeParse({ version: 'release candidate/1', title: '', remark: '' });
    expect(result.success).toBe(false);
  });
});
