import { beforeEach, describe, expect, test, vi } from 'vitest';

const { authMock, deleteProductMock, getVersionDownloadabilityMapMock, productFindFirstMock, serializeProductDetailMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  deleteProductMock: vi.fn(),
  getVersionDownloadabilityMapMock: vi.fn(),
  productFindFirstMock: vi.fn(),
  serializeProductDetailMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/server/upload-service', () => ({
  deleteProduct: deleteProductMock,
  getVersionDownloadabilityMap: getVersionDownloadabilityMapMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findFirst: productFindFirstMock,
    },
  },
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeProductDetail: serializeProductDetailMock,
}));

import { DELETE, GET } from '@/app/api/products/[key]/route';

describe('/api/products/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
      },
    });
  });

  test('returns product detail with per-version downloadability', async () => {
    const product = {
      id: 1,
      key: 'crm',
      name: 'CRM',
      description: null,
      createdAt: new Date('2026-03-27T02:00:00.000Z'),
      versions: [
        {
          id: 11,
          productId: 1,
          version: 'v1.0.0',
          title: '首版',
          remark: null,
          storagePath: 'C:/prototypes/crm/v1.0.0',
          entryUrl: '/prototypes/user-1/crm/v1.0.0/index.html',
          status: 'published',
          isDefault: true,
          createdAt: new Date('2026-03-27T01:00:00.000Z'),
        },
      ],
    };

    productFindFirstMock.mockResolvedValue(product);
    getVersionDownloadabilityMapMock.mockResolvedValue({ 'v1.0.0': true });
    serializeProductDetailMock.mockReturnValue({
      id: 1,
      key: 'crm',
      name: 'CRM',
      description: null,
      createdAt: '2026-03-27T02:00:00.000Z',
      publishedCount: 1,
      versions: [
        {
          id: 11,
          version: 'v1.0.0',
          title: '首版',
          remark: null,
          entryUrl: '/prototypes/user-1/crm/v1.0.0/index.html',
          status: 'published',
          isDefault: true,
          isLatest: true,
          downloadable: true,
          createdAt: '2026-03-27T01:00:00.000Z',
        },
      ],
    });

    const response = await GET(new Request('http://localhost/api/products/crm'), {
      params: Promise.resolve({ key: 'crm' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        key: 'crm',
        versions: [{ version: 'v1.0.0', downloadable: true }],
      },
    });
    expect(productFindFirstMock).toHaveBeenCalledWith({
      where: { key: 'crm', ownerId: 'user-1' },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    expect(getVersionDownloadabilityMapMock).toHaveBeenCalledWith('user-1', 'crm', ['v1.0.0']);
    expect(serializeProductDetailMock).toHaveBeenCalledWith(product, { 'v1.0.0': true });
  });

  test('returns success payload when deletion succeeds', async () => {
    deleteProductMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/products/crm'), {
      params: Promise.resolve({ key: 'crm' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: '产品已删除',
    });
    expect(deleteProductMock).toHaveBeenCalledWith('user-1', 'crm');
  });

  test('returns a 404 payload when product deletion targets a missing product', async () => {
    deleteProductMock.mockRejectedValue(new Error('Product not found'));

    const response = await DELETE(new Request('http://localhost/api/products/crm'), {
      params: Promise.resolve({ key: 'crm' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Product not found',
    });
  });
});
