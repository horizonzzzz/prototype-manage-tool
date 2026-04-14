import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  pathExistsMock,
  removeMock,
  productFindFirstMock,
  productVersionDeleteMock,
  productVersionFindFirstMock,
  productVersionUpdateMock,
  uploadRecordDeleteManyMock,
  uploadRecordFindFirstMock,
  uploadRecordFindManyMock,
  productDeleteMock,
  transactionMock,
  deleteSourceSnapshotForVersionMock,
  deleteSourceSnapshotsForProductMock,
  deleteSourceIndexForVersionMock,
  deleteSourceIndexesForProductMock,
} =
  vi.hoisted(() => ({
    pathExistsMock: vi.fn(),
    removeMock: vi.fn(),
    productFindFirstMock: vi.fn(),
    productVersionDeleteMock: vi.fn(),
    productVersionFindFirstMock: vi.fn(),
    productVersionUpdateMock: vi.fn(),
    uploadRecordDeleteManyMock: vi.fn(),
    uploadRecordFindFirstMock: vi.fn(),
    uploadRecordFindManyMock: vi.fn(),
    productDeleteMock: vi.fn(),
    transactionMock: vi.fn(),
    deleteSourceSnapshotForVersionMock: vi.fn(),
    deleteSourceSnapshotsForProductMock: vi.fn(),
    deleteSourceIndexForVersionMock: vi.fn(),
    deleteSourceIndexesForProductMock: vi.fn(),
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
      findFirst: productFindFirstMock,
      delete: productDeleteMock,
    },
    productVersion: {
      delete: productVersionDeleteMock,
      findFirst: productVersionFindFirstMock,
      update: productVersionUpdateMock,
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

vi.mock('@/lib/server/source-snapshot-service', () => ({
  deleteSourceSnapshotForVersion: deleteSourceSnapshotForVersionMock,
  deleteSourceSnapshotsForProduct: deleteSourceSnapshotsForProductMock,
  deleteSourceIndexForVersion: deleteSourceIndexForVersionMock,
  deleteSourceIndexesForProduct: deleteSourceIndexesForProductMock,
}));

import { deleteProduct, deleteVersion, getVersionDownloadabilityMap, getVersionSourceArchive } from '@/lib/server/upload-service';

describe('deleteVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathExistsMock.mockResolvedValue(false);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        productVersion: {
          delete: productVersionDeleteMock,
          findFirst: productVersionFindFirstMock,
          update: productVersionUpdateMock,
        },
      }),
    );
  });

  test('cleans up published assets and source snapshots for a deleted version', async () => {
    productVersionFindFirstMock
      .mockResolvedValueOnce({
        id: 11,
        version: 'v1.0.0',
        productId: 1,
        product: { key: 'crm' },
        status: 'published',
      })
      .mockResolvedValueOnce(null);
    productVersionDeleteMock.mockResolvedValue({ id: 11 });
    removeMock.mockResolvedValue(undefined);
    deleteSourceSnapshotForVersionMock.mockResolvedValue(undefined);
    deleteSourceIndexForVersionMock.mockResolvedValue(undefined);

    await deleteVersion('user-1', 11);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(productVersionDeleteMock).toHaveBeenCalledWith({ where: { id: 11 } });
    expect(removeMock).toHaveBeenCalledWith(path.join('C:/prototypes-root', 'user-1', 'crm', 'v1.0.0'));
    expect(deleteSourceSnapshotForVersionMock).toHaveBeenCalledWith('user-1', 'crm', 'v1.0.0');
    expect(deleteSourceIndexForVersionMock).toHaveBeenCalledWith('user-1', 'crm', 'v1.0.0');
  });
});

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
    productFindFirstMock.mockResolvedValue({
      id: 1,
      key: 'crm',
      versions: [{ id: 11, version: 'v1.0.0' }],
    });
    uploadRecordDeleteManyMock.mockResolvedValue({ count: 2 });
    productDeleteMock.mockResolvedValue({ id: 1 });
    removeMock.mockResolvedValue(undefined);
    deleteSourceIndexesForProductMock.mockResolvedValue(undefined);

    await deleteProduct('user-1', 'crm');

    expect(productFindFirstMock).toHaveBeenCalledWith({
      where: { key: 'crm', ownerId: 'user-1' },
      include: { versions: true },
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(uploadRecordDeleteManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', productKey: 'crm' },
    });
    expect(productDeleteMock).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(removeMock).toHaveBeenCalledWith(path.join('C:/prototypes-root', 'user-1', 'crm'));
    expect(deleteSourceSnapshotsForProductMock).toHaveBeenCalledWith('user-1', 'crm');
    expect(deleteSourceIndexesForProductMock).toHaveBeenCalledWith('user-1', 'crm');
  });

  test('throws when deleting a missing product', async () => {
    productFindFirstMock.mockResolvedValue(null);

    await expect(deleteProduct('user-1', 'missing')).rejects.toThrow('Product not found');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
    expect(deleteSourceSnapshotsForProductMock).not.toHaveBeenCalled();
    expect(deleteSourceIndexesForProductMock).not.toHaveBeenCalled();
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

    await expect(
      getVersionDownloadabilityMap('user-1', 'crm', ['v1.0.0', 'v1.1.0', 'v2.0.0', 'v3.0.0']),
    ).resolves.toEqual({
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

    await expect(getVersionDownloadabilityMap('user-1', 'crm', ['v1.0.0'])).resolves.toEqual({
      'v1.0.0': false,
    });
  });
});

describe('getVersionSourceArchive', () => {
  test('returns the latest successful source archive for a version when the file exists', async () => {
    productVersionFindFirstMock.mockResolvedValue({
      id: 7,
      version: 'v1.0.0',
      product: { key: 'crm' },
    });
    uploadRecordFindFirstMock.mockResolvedValue({
      fileName: 'crm-v1.zip',
      sourceArchivePath: 'C:/archives/crm-v1.zip',
    });
    pathExistsMock.mockResolvedValue(true);

    await expect(getVersionSourceArchive('user-1', 7)).resolves.toEqual({
      fileName: 'crm-v1.zip',
      filePath: 'C:/archives/crm-v1.zip',
    });
  });

  test('returns null when the upload record query hits an old sqlite schema', async () => {
    productVersionFindFirstMock.mockResolvedValue({
      id: 7,
      version: 'v1.0.0',
      product: { key: 'crm' },
    });
    uploadRecordFindFirstMock.mockRejectedValue(
      Object.assign(new Error('no such column: main.UploadRecord.sourceArchivePath'), {
        code: 'P2022',
      }),
    );

    await expect(getVersionSourceArchive('user-1', 7)).resolves.toBeNull();
  });
});
