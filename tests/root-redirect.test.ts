import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const rootPageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

describe('root redirect contract', () => {
  test('keeps root route redirecting to /admin', () => {
    expect(rootPageSource).toContain("redirect('/admin')");
  });
});
