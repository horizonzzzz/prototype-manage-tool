import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const uploadDialogSource = readFileSync(new URL('../components/admin/upload-version-dialog.tsx', import.meta.url), 'utf8');

describe('admin upload dialog reset behavior', () => {
  test('keeps outside interaction and escape guarded while an upload is running', () => {
    expect(uploadDialogSource).toContain('onInteractOutside={(event) => uploading && event.preventDefault()}');
    expect(uploadDialogSource).toContain('onEscapeKeyDown={(event) => uploading && event.preventDefault()}');
    expect(uploadDialogSource).not.toContain('w-[min(96vw,960px)]');
  });

  test('resets only the upload form state when the dialog closes and keeps build log tracking separate', () => {
    expect(adminDashboardSource).toContain('const resetUploadFormState = () =>');
    expect(adminDashboardSource).toContain('uploadForm.reset();');
    expect(adminDashboardSource).toContain('setSelectedUploadFile(null);');
    expect(adminDashboardSource).toContain('setUploadError(undefined);');
    expect(adminDashboardSource).not.toContain('setUploadProgress(0);');
    expect(adminDashboardSource).toContain('if (!open) {');
    expect(adminDashboardSource).toContain('resetUploadFormState();');
    expect(adminDashboardSource).toContain('setBuildProgressDialogOpen(true);');
  });
});
