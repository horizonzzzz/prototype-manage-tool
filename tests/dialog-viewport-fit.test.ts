import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dialogSource = readFileSync(new URL('../components/ui/dialog.tsx', import.meta.url), 'utf8');
const uploadDialogSource = readFileSync(new URL('../components/admin/upload-version-dialog.tsx', import.meta.url), 'utf8');

describe('dialog viewport fit', () => {
  test('keeps shared dialog content within the viewport and scrollable when content is tall', () => {
    expect(dialogSource).toContain('max-h-[calc(100vh-2rem)]');
    expect(dialogSource).toContain('overflow-y-auto');
  });

  test('lets the upload dialog body grow inside the constrained dialog instead of overflowing past the screen edges', () => {
    expect(uploadDialogSource).toContain('min-h-0');
    expect(uploadDialogSource).toContain('overflow-y-auto');
  });
});
