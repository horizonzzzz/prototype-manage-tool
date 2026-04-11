import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const previewPageSource = readProjectSource('app/preview/page.tsx');
const previewProductRouteSource = readProjectSource('app/preview/[productKey]/page.tsx');
const previewVersionRouteSource = readProjectSource('app/preview/[productKey]/[version]/page.tsx');

describe('preview route migration', () => {
  test('creates nested preview routes and a dedicated preview product list component', () => {
    expect(projectFileExists('app/preview/[productKey]/page.tsx')).toBe(true);
    expect(projectFileExists('app/preview/[productKey]/[version]/page.tsx')).toBe(true);
    expect(projectFileExists('components/preview/preview-product-list.tsx')).toBe(true);
  });

  test('turns the preview entry page into a product list surface instead of mounting the old browser directly', () => {
    expect(previewPageSource).not.toContain('<PreviewBrowser');
    expect(previewPageSource).toContain('PreviewProductList');
  });

  test('keeps the preview entry page as a pure list surface without list-query modal state', () => {
    expect(previewPageSource).not.toContain('selectedProductKey');
    expect(previewPageSource).not.toContain('selectedVersion');
    expect(previewPageSource).not.toContain('product=');
    expect(previewPageSource).not.toContain('version=');
  });

  test('uses dedicated standalone viewer route canonicalization', () => {
    expect(previewProductRouteSource).toContain('buildPreviewStateHref');
    expect(previewProductRouteSource).toContain('searchParams');
    expect(previewProductRouteSource).not.toContain("redirect('/preview?product=");
    expect(previewVersionRouteSource).toContain('buildPreviewStateHref');
  });
});
