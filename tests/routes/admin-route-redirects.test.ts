import { beforeEach, describe, expect, test, vi } from 'vitest';

const { redirectMock, findManyMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string | { href: string; locale?: string }) => {
    const href = typeof target === 'string' ? target : target.href;
    throw new Error(`REDIRECT:${href}`);
  }),
  findManyMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('zh'),
}));

vi.mock('@/lib/server/session-user', () => ({
  requirePageUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: findManyMock,
    },
  },
}));

vi.mock('@/components/admin/pages/admin-product-list-page', () => ({
  AdminProductListPage: () => null,
}));

import AdminPage from '@/app/[locale]/(workspace)/admin/page';
import AdminProductPage from '@/app/[locale]/(workspace)/admin/[productKey]/page';

describe('admin route redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).React = {
      createElement: () => null,
    };
  });

  test('redirects legacy admin query params to the new segment route', async () => {
    await expect(
      AdminPage({
        searchParams: Promise.resolve({ product: 'erp' }),
      }),
    ).rejects.toThrow('REDIRECT:/admin/erp');
  });

  test('redirects invalid admin product routes to the first valid product route', async () => {
    findManyMock.mockResolvedValue([{ key: 'crm' }, { key: 'erp' }]);

    await expect(
      AdminProductPage({
        params: Promise.resolve({ productKey: 'broken-key' }),
      }),
    ).rejects.toThrow('REDIRECT:/admin/crm');
  });

  test('loads admin product list with newest products first when no redirect is needed', async () => {
    findManyMock.mockResolvedValue([]);

    await AdminPage({
      searchParams: Promise.resolve({}),
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      include: { versions: true },
      orderBy: { createdAt: 'desc' },
    });
  });
});
