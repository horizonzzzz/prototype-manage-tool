import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const adminDashboardSource = readProjectSource('components/admin-dashboard.tsx');
const uploadDialogSource = readProjectSource('components/admin/dialogs/upload-version-dialog.tsx');

describe('admin upload dialog reset behavior', () => {
  test('keeps outside interaction and escape guarded while an upload is running', () => {
    expect(uploadDialogSource).toContain('onInteractOutside={(event) => uploading && event.preventDefault()}');
    expect(uploadDialogSource).toContain('onEscapeKeyDown={(event) => uploading && event.preventDefault()}');
    expect(uploadDialogSource).not.toContain('w-[min(96vw,960px)]');
  });

  test('resets only the upload form state when the dialog closes and keeps build log tracking separate', () => {
    expect(adminDashboardSource).toContain('function resetUploadFormState(): void');
    expect(adminDashboardSource).toContain('uploadForm.reset();');
    expect(adminDashboardSource).toContain('setSelectedUploadFile(null);');
    expect(adminDashboardSource).toContain('setUploadError(undefined);');
    expect(adminDashboardSource).not.toContain('setUploadProgress(0);');
    expect(adminDashboardSource).toContain('if (!open) {');
    expect(adminDashboardSource).toContain('resetUploadFormState();');
    expect(adminDashboardSource).toContain('setBuildProgressDialogOpen(true);');
  });
});
