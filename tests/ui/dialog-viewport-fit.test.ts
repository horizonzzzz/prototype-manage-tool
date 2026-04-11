import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const dialogSource = readProjectSource('components/ui/dialog.tsx');
const uploadDialogSource = readProjectSource('components/admin/dialogs/upload-version-dialog.tsx');

describe('dialog viewport fit', () => {
  test('keeps shared dialog content within the viewport and scrollable when content is tall', () => {
    expect(dialogSource).toContain('max-h-[calc(100vh-2rem)]');
    expect(dialogSource).toContain('overflow-y-auto');
  });

  test('keeps the default shared dialog width constraint for standard dialogs', () => {
    expect(dialogSource).toContain('sm:max-w-sm');
  });

  test('lets the upload dialog body grow inside the constrained dialog instead of overflowing past the screen edges', () => {
    expect(uploadDialogSource).toContain('min-h-0');
    expect(uploadDialogSource).toContain('overflow-y-auto');
  });
});


