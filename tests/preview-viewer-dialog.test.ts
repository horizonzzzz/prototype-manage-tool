import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const previewViewerDialogSource = readFileSync(new URL('../components/preview/preview-viewer-dialog.tsx', import.meta.url), 'utf8');

describe('PreviewViewerDialog source', () => {
  test('uses a true fullscreen dialog instead of an inset modal shell', () => {
    expect(previewViewerDialogSource).toContain('h-screen w-screen');
    expect(previewViewerDialogSource).not.toContain('calc(100vh-1rem)');
    expect(previewViewerDialogSource).not.toContain('calc(100vw-1rem)');
    expect(previewViewerDialogSource).not.toContain("desktop: 'h-full w-full rounded-[28px]");
  });

  test('keeps device switching available on mobile instead of hiding it below md', () => {
    expect(previewViewerDialogSource).not.toContain('hidden items-center gap-1');
    expect(previewViewerDialogSource).not.toContain('md:flex');
    expect(previewViewerDialogSource).toContain("desktop: 'w-full h-full rounded-none border-0'");
  });
});
