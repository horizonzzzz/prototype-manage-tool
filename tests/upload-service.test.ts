import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { removeMock, productFindUniqueMock, uploadRecordDeleteManyMock, productDeleteMock, transactionMock } =
  vi.hoisted(() => ({
    removeMock: vi.fn(),
    productFindUniqueMock: vi.fn(),
    uploadRecordDeleteManyMock: vi.fn(),
    productDeleteMock: vi.fn(),
    transactionMock: vi.fn(),
  }));

vi.mock('fs-extra', () => ({
  default: {
    remove: removeMock,
  },
}));

vi.mock('@/lib/config', () => ({
  appConfig: {
    prototypesDir: 'C:/prototypes-root',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: productFindUniqueMock,
      delete: productDeleteMock,
    },
    uploadRecord: {
      deleteMany: uploadRecordDeleteManyMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock('@/lib/server/build-job-service', () => ({
  createBuildJob: vi.fn(),
}));

import { deleteProduct } from '@/lib/server/upload-service';

describe('deleteProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        uploadRecord: {
          deleteMany: uploadRecordDeleteManyMock,
        },
        product: {
          delete: productDeleteMock,
        },
      }),
    );
  });

  test('removes upload records, product data, and published files for an existing product', async () => {
    productFindUniqueMock.mockResolvedValue({
      id: 1,
      key: 'crm',
      versions: [{ id: 11, version: 'v1.0.0' }],
    });
    uploadRecordDeleteManyMock.mockResolvedValue({ count: 2 });
    productDeleteMock.mockResolvedValue({ id: 1 });
    removeMock.mockResolvedValue(undefined);

    await deleteProduct('crm');

    expect(productFindUniqueMock).toHaveBeenCalledWith({
      where: { key: 'crm' },
      include: { versions: true },
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(uploadRecordDeleteManyMock).toHaveBeenCalledWith({
      where: { productKey: 'crm' },
    });
    expect(productDeleteMock).toHaveBeenCalledWith({
      where: { key: 'crm' },
    });
    expect(removeMock).toHaveBeenCalledWith(path.join('C:/prototypes-root', 'crm'));
  });

  test('throws when deleting a missing product', async () => {
    productFindUniqueMock.mockResolvedValue(null);

    await expect(deleteProduct('missing')).rejects.toThrow('Product not found');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });
});
