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

  test('uses query-driven preview viewer state from the preview list page', () => {
    expect(previewPageSource).toContain('selectedProductKey');
    expect(previewPageSource).toContain('selectedVersion');
    expect(previewPageSource).not.toContain('redirect(buildPreviewHref(product, version))');
  });

  test('redirects legacy nested preview routes into preview list query state', () => {
    expect(previewProductRouteSource).toContain('buildPreviewStateHref');
    expect(previewVersionRouteSource).toContain('buildPreviewStateHref');
  });
});
