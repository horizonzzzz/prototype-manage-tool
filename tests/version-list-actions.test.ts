import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const versionListSource = readFileSync(new URL('../components/admin/version-list-content.tsx', import.meta.url), 'utf8');
const adminDashboardSource = readFileSync(new URL('../components/admin-dashboard.tsx', import.meta.url), 'utf8');

describe('version list actions', () => {
  test('removes preview action from the admin version list', () => {
    expect(versionListSource).not.toContain('Eye');
    expect(versionListSource).not.toContain('预览');
    expect(versionListSource).not.toContain('onPreview');
    expect(adminDashboardSource).not.toContain('onPreview={(item)');
  });
});
