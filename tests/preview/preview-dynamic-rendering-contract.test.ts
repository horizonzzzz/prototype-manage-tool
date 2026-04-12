import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const previewPageSource = readProjectSource('app/[locale]/(preview)/preview/page.tsx');
const previewProductRouteSource = readProjectSource('app/[locale]/(preview)/preview/[productKey]/page.tsx');
const previewVersionRouteSource = readProjectSource('app/[locale]/(preview)/preview/[productKey]/[version]/page.tsx');

describe('preview dynamic rendering contract', () => {
  test('forces runtime rendering for preview entry routes so Docker uploads appear without rebuilding', () => {
    expect(previewPageSource).toContain("export const dynamic = 'force-dynamic'");
    expect(previewProductRouteSource).toContain("export const dynamic = 'force-dynamic'");
    expect(previewVersionRouteSource).toContain("export const dynamic = 'force-dynamic'");
  });
});
