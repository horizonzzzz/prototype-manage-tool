import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const previewPagePath = new URL('../app/preview/page.tsx', import.meta.url);
const previewProductRoutePath = new URL('../app/preview/[productKey]/page.tsx', import.meta.url);
const previewVersionRoutePath = new URL('../app/preview/[productKey]/[version]/page.tsx', import.meta.url);
const previewListComponentPath = new URL('../components/preview/preview-product-list.tsx', import.meta.url);

const previewPageSource = readFileSync(previewPagePath, 'utf8');
const previewProductRouteSource = readFileSync(previewProductRoutePath, 'utf8');
const previewVersionRouteSource = readFileSync(previewVersionRoutePath, 'utf8');

describe('preview route migration', () => {
  test('creates nested preview routes and a dedicated preview product list component', () => {
    expect(existsSync(previewProductRoutePath)).toBe(true);
    expect(existsSync(previewVersionRoutePath)).toBe(true);
    expect(existsSync(previewListComponentPath)).toBe(true);
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
