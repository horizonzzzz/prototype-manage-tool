import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const uploadVersionFormSource = readProjectSource('components/admin/forms/upload-version-form.tsx');

describe('upload version form', () => {
  test('keeps the optional title field available for new uploads', () => {
    expect(uploadVersionFormSource).toContain("useTranslations('admin.uploadVersionForm')");
    expect(uploadVersionFormSource).toContain("form.register('title')");
  });
});
