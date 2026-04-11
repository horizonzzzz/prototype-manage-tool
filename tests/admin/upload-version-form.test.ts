import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const uploadVersionFormSource = readProjectSource('components/admin/forms/upload-version-form.tsx');

describe('upload version form', () => {
  test('keeps the optional title field available for new uploads', () => {
    expect(uploadVersionFormSource).toContain('label="版本标题 (可选)"');
    expect(uploadVersionFormSource).toContain("form.register('title')");
  });
});
