import { beforeEach, describe, expect, test, vi } from 'vitest';

const { deleteProductMock } = vi.hoisted(() => ({
  deleteProductMock: vi.fn(),
}));

vi.mock('@/lib/server/upload-service', () => ({
  deleteProduct: deleteProductMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeProductDetail: vi.fn(),
}));

import { DELETE } from '@/app/api/products/[key]/route';

describe('DELETE /api/products/[key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(deleteProductMock).toHaveBeenCalledWith('crm');
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
