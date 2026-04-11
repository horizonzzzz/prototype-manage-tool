import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const adminPageSource = readProjectSource('app/admin/page.tsx');

describe('admin route migration', () => {
  test('creates nested admin product route and a dedicated admin product list component', () => {
    expect(projectFileExists('app/admin/[productKey]/page.tsx')).toBe(true);
    expect(projectFileExists('components/admin/panels/admin-product-list.tsx')).toBe(true);
  });

  test('turns the admin entry page into a product list surface instead of mounting the old dashboard directly', () => {
    expect(adminPageSource).not.toContain('<AdminDashboard');
    expect(adminPageSource).toContain('AdminProductListPage');
  });
});
