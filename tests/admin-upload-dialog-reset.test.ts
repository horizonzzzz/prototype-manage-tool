import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const uploadDialogSource = readFileSync(new URL('../components/admin/upload-version-dialog.tsx', import.meta.url), 'utf8');

describe('admin upload dialog reset behavior', () => {
  test('prevents outside interaction and escape from closing the upload dialog', () => {
    expect(uploadDialogSource).toContain('onInteractOutside={(event) => event.preventDefault()}');
    expect(uploadDialogSource).toContain('onEscapeKeyDown={(event) => event.preventDefault()}');
  });

  test('resets upload form and progress state when the dialog closes', () => {
    expect(adminDashboardSource).toContain('const resetUploadDialogState = () =>');
    expect(adminDashboardSource).toContain('uploadForm.reset();');
    expect(adminDashboardSource).toContain('setSelectedUploadFile(null);');
    expect(adminDashboardSource).toContain('setUploadError(undefined);');
    expect(adminDashboardSource).toContain('setUploadProgress(0);');
    expect(adminDashboardSource).toContain('setActiveJobId(undefined);');
    expect(adminDashboardSource).toContain('setActiveJob(null);');
    expect(adminDashboardSource).toContain('setActiveJobLog(null);');
    expect(adminDashboardSource).toContain('setSelectedLogStepKey(null);');
    expect(adminDashboardSource).toContain('setIsLogStepPinned(false);');
    expect(adminDashboardSource).toContain('if (!open) {');
    expect(adminDashboardSource).toContain('resetUploadDialogState();');
  });
});
