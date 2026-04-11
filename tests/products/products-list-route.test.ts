import { beforeEach, describe, expect, test, vi } from 'vitest';

const { productFindManyMock, serializeProductListItemMock } = vi.hoisted(() => ({
  productFindManyMock: vi.fn(),
  serializeProductListItemMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: productFindManyMock,
    },
  },
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeProductListItem: serializeProductListItemMock,
}));

import { GET } from '@/app/api/products/route';

describe('/api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns products ordered by newest first', async () => {
    const product = {
      id: 2,
      key: 'erp',
      name: 'ERP',
      description: null,
      createdAt: new Date('2026-04-08T08:00:00.000Z'),
      versions: [],
    };

    productFindManyMock.mockResolvedValue([product]);
    serializeProductListItemMock.mockReturnValue({
      id: 2,
      key: 'erp',
      name: 'ERP',
      description: null,
      createdAt: '2026-04-08T08:00:00.000Z',
      publishedCount: 0,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ key: 'erp' }],
    });
    expect(productFindManyMock).toHaveBeenCalledWith({
      include: { versions: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(serializeProductListItemMock).toHaveBeenCalledWith(product, 0, [product]);
  });
});
