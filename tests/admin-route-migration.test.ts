import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const adminPagePath = new URL('../app/admin/page.tsx', import.meta.url);
const adminProductRoutePath = new URL('../app/admin/[productKey]/page.tsx', import.meta.url);
const adminListComponentPath = new URL('../components/admin/admin-product-list.tsx', import.meta.url);

const adminPageSource = readFileSync(adminPagePath, 'utf8');

describe('admin route migration', () => {
  test('creates nested admin product route and a dedicated admin product list component', () => {
    expect(existsSync(adminProductRoutePath)).toBe(true);
    expect(existsSync(adminListComponentPath)).toBe(true);
  });

  test('turns the admin entry page into a product list surface instead of mounting the old dashboard directly', () => {
    expect(adminPageSource).not.toContain('<AdminDashboard');
    expect(adminPageSource).toContain('AdminProductList');
  });
});
