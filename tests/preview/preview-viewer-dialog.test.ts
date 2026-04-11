import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const previewViewerDialogSource = readProjectSource('components/preview/preview-viewer-dialog.tsx');

describe('PreviewViewerDialog source', () => {
  test('uses a true fullscreen dialog instead of an inset modal shell', () => {
    expect(previewViewerDialogSource).toContain('h-screen w-screen');
    expect(previewViewerDialogSource).toContain('sm:max-w-none');
    expect(previewViewerDialogSource).not.toContain('calc(100vh-1rem)');
    expect(previewViewerDialogSource).not.toContain('calc(100vw-1rem)');
    expect(previewViewerDialogSource).not.toContain("desktop: 'h-full w-full rounded-[28px]");
  });

  test('keeps device switching available on mobile instead of hiding it below md', () => {
    expect(previewViewerDialogSource).not.toContain('hidden items-center gap-1');
    expect(previewViewerDialogSource).not.toContain('md:flex');
    expect(previewViewerDialogSource).toContain("desktop: 'w-full h-full rounded-none border-0'");
  });

  test('provides dialog title and description for radix accessibility requirements', () => {
    expect(previewViewerDialogSource).toContain('DialogTitle');
    expect(previewViewerDialogSource).toContain('DialogDescription');
  });
});

