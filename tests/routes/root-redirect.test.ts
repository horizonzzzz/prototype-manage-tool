import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const localeRootPageSource = readProjectSource('app/[locale]/page.tsx');

describe('root redirect contract', () => {
  test('redirects the locale root route to the locale-aware admin entry', () => {
    expect(localeRootPageSource).toContain("from '@/i18n/navigation'");
    expect(localeRootPageSource).toContain("href: '/admin'");
  });
});
