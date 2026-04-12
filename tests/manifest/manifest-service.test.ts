import { beforeEach, describe, expect, test, vi } from 'vitest';

const { productFindManyMock, serializeManifestProductMock, noStoreMock } = vi.hoisted(() => ({
  productFindManyMock: vi.fn(),
  serializeManifestProductMock: vi.fn(),
  noStoreMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: productFindManyMock,
    },
  },
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeManifestProduct: serializeManifestProductMock,
}));

vi.mock('next/cache', () => ({
  unstable_noStore: noStoreMock,
}));

import { getManifest } from '@/lib/server/manifest-service';

describe('getManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns preview products ordered by newest first', async () => {
    const newerProduct = {
      id: 2,
      key: 'erp',
      name: 'ERP',
      createdAt: new Date('2026-04-09T08:00:00.000Z'),
      versions: [
        {
          id: 21,
          productId: 2,
          version: 'v2.0.0',
          title: null,
          remark: null,
          entryUrl: '/prototypes/erp/v2.0.0/index.html',
          status: 'published',
          isDefault: true,
          createdAt: new Date('2026-04-09T08:30:00.000Z'),
        },
      ],
    };
    const olderProduct = {
      id: 1,
      key: 'crm',
      name: 'CRM',
      createdAt: new Date('2026-04-08T08:00:00.000Z'),
      versions: [
        {
          id: 11,
          productId: 1,
          version: 'v1.0.0',
          title: null,
          remark: null,
          entryUrl: '/prototypes/crm/v1.0.0/index.html',
          status: 'published',
          isDefault: true,
          createdAt: new Date('2026-04-08T08:30:00.000Z'),
        },
      ],
    };

    productFindManyMock.mockResolvedValue([newerProduct, olderProduct]);
    serializeManifestProductMock.mockImplementation((product: any) => ({
      key: product.key,
      name: product.name,
      defaultVersion: product.versions[0]?.version ?? null,
      createdAt: product.createdAt.toISOString(),
      versions: product.versions.map((version: any) => ({
        version: version.version,
        title: version.title,
        remark: version.remark,
        entryUrl: version.entryUrl,
        createdAt: version.createdAt.toISOString(),
        isDefault: version.isDefault,
        isLatest: true,
      })),
    }));

    const manifest = await getManifest();

    expect(productFindManyMock).toHaveBeenCalledWith({
      include: {
        versions: {
          where: { status: 'published' },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(manifest.products.map((item) => item.key)).toEqual(['erp', 'crm']);
    expect(manifest.resolved).toEqual({
      productKey: 'erp',
      version: 'v2.0.0',
    });
  });

  test('opts out of static caching so preview data reflects runtime uploads', async () => {
    productFindManyMock.mockResolvedValue([]);
    serializeManifestProductMock.mockImplementation((product: any) => product);

    await getManifest();

    expect(noStoreMock).toHaveBeenCalledTimes(1);
  });
});
