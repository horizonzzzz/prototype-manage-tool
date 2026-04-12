import { beforeEach, describe, expect, test, vi } from 'vitest';

const { authMock, productCreateMock, productFindManyMock, serializeProductListItemMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  productCreateMock: vi.fn(),
  productFindManyMock: vi.fn(),
  serializeProductListItemMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      create: productCreateMock,
      findMany: productFindManyMock,
    },
  },
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeProductListItem: serializeProductListItemMock,
}));

import { GET, POST } from '@/app/api/products/route';

describe('/api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
      },
    });
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
      where: { ownerId: 'user-1' },
      include: { versions: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(serializeProductListItemMock).toHaveBeenCalledWith(product, 0, [product]);
  });

  test('creates products under the current user', async () => {
    const product = {
      id: 3,
      key: 'crm',
      name: 'CRM',
      description: null,
      createdAt: new Date('2026-04-08T08:00:00.000Z'),
      versions: [],
    };

    productCreateMock.mockResolvedValue(product);
    serializeProductListItemMock.mockReturnValue({
      id: 3,
      key: 'crm',
      name: 'CRM',
      description: null,
      createdAt: '2026-04-08T08:00:00.000Z',
      publishedCount: 0,
    });

    const response = await POST(
      new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'crm',
          name: 'CRM',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(productCreateMock).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        key: 'crm',
        name: 'CRM',
        description: null,
      },
      include: { versions: true },
    });
  });
});
