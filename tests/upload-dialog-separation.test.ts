import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const dashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');
const uploadDialogSource = readFileSync(new URL('../components/admin/upload-version-dialog.tsx', import.meta.url), 'utf8');

describe('upload dialog separation', () => {
  test('keeps the upload form dialog free of build progress content', () => {
    expect(uploadDialogSource).not.toContain('CurrentJobContent');
    expect(uploadDialogSource).not.toContain('构建进度');
    expect(uploadDialogSource).not.toContain('terminalContent');
  });

  test('mounts a dedicated build progress dialog from the admin dashboard', () => {
    expect(dashboardSource).toContain('BuildProgressDialog');
  });
});
