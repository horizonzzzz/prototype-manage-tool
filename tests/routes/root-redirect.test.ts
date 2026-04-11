import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const rootPageSource = readProjectSource('app/page.tsx');

describe('root redirect contract', () => {
  test('keeps root route redirecting to /admin', () => {
    expect(rootPageSource).toContain("redirect('/admin')");
  });
});
