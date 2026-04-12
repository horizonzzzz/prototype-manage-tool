import { describe, expect, test } from 'vitest';

import { readProjectSource } from '@/tests/support/project-source';

const previewProductListSource = readProjectSource('components/preview/preview-product-list.tsx');

describe('PreviewProductList source', () => {
  test('uses published entry urls for copy and new window actions instead of preview state routes', () => {
    expect(previewProductListSource).not.toContain('buildLocalizedPreviewStateHref');
    expect(previewProductListSource).not.toContain('resolvePreviewStateUrl(');
    expect(previewProductListSource).not.toContain('new URL(resolvePreviewStateUrl');
    expect(previewProductListSource).toContain('resolvePreviewEntryUrl(version.entryUrl, window.location.origin)');
    expect(previewProductListSource).toContain('copyText(target)');
    expect(previewProductListSource).toContain("window.open(target, '_blank', 'noopener,noreferrer')");
  });
});
