import { beforeEach, describe, expect, test, vi } from 'vitest';

const { redirectMock, findManyMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  findManyMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: findManyMock,
    },
  },
}));

import AdminPage from '@/app/admin/page';
import AdminProductPage from '@/app/admin/[productKey]/page';

describe('admin route redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
