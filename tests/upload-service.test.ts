import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { pathExistsMock, removeMock, productFindUniqueMock, productVersionFindUniqueMock, uploadRecordDeleteManyMock, uploadRecordFindFirstMock, uploadRecordFindManyMock, productDeleteMock, transactionMock } =
  vi.hoisted(() => ({
    pathExistsMock: vi.fn(),
    removeMock: vi.fn(),
    productFindUniqueMock: vi.fn(),
    productVersionFindUniqueMock: vi.fn(),
    uploadRecordDeleteManyMock: vi.fn(),
    uploadRecordFindFirstMock: vi.fn(),
    uploadRecordFindManyMock: vi.fn(),
    productDeleteMock: vi.fn(),
    transactionMock: vi.fn(),
  }));

vi.mock('fs-extra', () => ({
  default: {
    pathExists: pathExistsMock,
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
    productVersion: {
      findUnique: productVersionFindUniqueMock,
    },
    uploadRecord: {
      deleteMany: uploadRecordDeleteManyMock,
      findFirst: uploadRecordFindFirstMock,
      findMany: uploadRecordFindManyMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock('@/lib/server/build-job-service', () => ({
  createBuildJob: vi.fn(),
}));

import { deleteProduct, getVersionDownloadabilityMap, getVersionSourceArchive } from '@/lib/server/upload-service';

describe('deleteProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathExistsMock.mockResolvedValue(false);
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

describe('getVersionDownloadabilityMap', () => {
  test('marks only versions with an existing latest successful source archive as downloadable', async () => {
    uploadRecordFindManyMock.mockResolvedValue([
      {
        version: 'v2.0.0',
        fileName: 'crm-v2-latest.zip',
        sourceArchivePath: 'C:/archives/crm-v2-latest.zip',
        createdAt: new Date('2026-03-27T03:00:00.000Z'),
      },
      {
        version: 'v2.0.0',
        fileName: 'crm-v2-old.zip',
        sourceArchivePath: 'C:/archives/crm-v2-old.zip',
        createdAt: new Date('2026-03-27T02:00:00.000Z'),
      },
      {
        version: 'v1.0.0',
        fileName: 'crm-v1.zip',
        sourceArchivePath: 'C:/archives/crm-v1.zip',
        createdAt: new Date('2026-03-27T01:00:00.000Z'),
      },
      {
        version: 'v1.1.0',
        fileName: 'crm-v1.1.zip',
        sourceArchivePath: null,
        createdAt: new Date('2026-03-27T00:30:00.000Z'),
      },
    ]);
    pathExistsMock.mockImplementation(async (targetPath: string) => targetPath === 'C:/archives/crm-v1.zip');

    await expect(getVersionDownloadabilityMap('crm', ['v1.0.0', 'v1.1.0', 'v2.0.0', 'v3.0.0'])).resolves.toEqual({
      'v1.0.0': true,
      'v1.1.0': false,
      'v2.0.0': false,
      'v3.0.0': false,
    });
  });

  test('gracefully degrades to disabled downloads when the sqlite schema is too old', async () => {
    uploadRecordFindManyMock.mockRejectedValue(
      Object.assign(new Error('The column `main.UploadRecord.sourceArchivePath` does not exist in the current database.'), {
        code: 'P2022',
      }),
    );

    await expect(getVersionDownloadabilityMap('crm', ['v1.0.0'])).resolves.toEqual({
      'v1.0.0': false,
    });
  });
});

describe('getVersionSourceArchive', () => {
  test('returns the latest successful source archive for a version when the file exists', async () => {
    productVersionFindUniqueMock.mockResolvedValue({
      id: 7,
      version: 'v1.0.0',
      product: { key: 'crm' },
    });
    uploadRecordFindFirstMock.mockResolvedValue({
      fileName: 'crm-v1.zip',
      sourceArchivePath: 'C:/archives/crm-v1.zip',
    });
    pathExistsMock.mockResolvedValue(true);

    await expect(getVersionSourceArchive(7)).resolves.toEqual({
      fileName: 'crm-v1.zip',
      filePath: 'C:/archives/crm-v1.zip',
    });
  });

  test('returns null when the upload record query hits an old sqlite schema', async () => {
    productVersionFindUniqueMock.mockResolvedValue({
      id: 7,
      version: 'v1.0.0',
      product: { key: 'crm' },
    });
    uploadRecordFindFirstMock.mockRejectedValue(
      Object.assign(new Error('no such column: main.UploadRecord.sourceArchivePath'), {
        code: 'P2022',
      }),
    );

    await expect(getVersionSourceArchive(7)).resolves.toBeNull();
  });
});
