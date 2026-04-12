import path from 'node:path';
import fs from 'node:fs/promises';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  productVersionFindManyMock,
  getVersionSourceArchiveMock,
  extractZipToTempMock,
  findFileRootMock,
  createSourceSnapshotMock,
} = vi.hoisted(() => ({
  productVersionFindManyMock: vi.fn(),
  getVersionSourceArchiveMock: vi.fn(),
  extractZipToTempMock: vi.fn(),
  findFileRootMock: vi.fn(),
  createSourceSnapshotMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVersion: {
      findMany: productVersionFindManyMock,
    },
  },
}));

vi.mock('@/lib/server/upload-service', () => ({
  getVersionSourceArchive: getVersionSourceArchiveMock,
}));

vi.mock('@/lib/server/fs-utils', () => ({
  extractZipToTemp: extractZipToTempMock,
  findFileRoot: findFileRootMock,
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  createSourceSnapshot: createSourceSnapshotMock,
}));

import { backfillSourceSnapshots } from '@/scripts/backfill-source-snapshots';

describe('backfillSourceSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('processes only published versions missing ready snapshots and skips ready or missing archive versions', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 10,
        version: 'v1.0.0',
        status: 'published',
        product: { key: 'crm', ownerId: 'user-1' },
        sourceSnapshot: { status: 'ready' },
      },
      {
        id: 11,
        version: 'v1.1.0',
        status: 'published',
        product: { key: 'crm', ownerId: 'user-1' },
        sourceSnapshot: null,
      },
      {
        id: 12,
        version: 'v1.2.0',
        status: 'published',
        product: { key: 'crm', ownerId: 'user-1' },
        sourceSnapshot: { status: 'failed' },
      },
    ]);
    getVersionSourceArchiveMock.mockImplementation(async (userId: string, versionId: number) => {
      if (userId === 'user-1' && versionId === 11) {
        return {
          fileName: 'crm-v1.1.0.zip',
          filePath: 'C:/archives/crm-v1.1.0.zip',
        };
      }

      return null;
    });
    findFileRootMock.mockImplementation(async (extractDir: string) => path.join(extractDir, 'project'));
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/crm/v1.1.0',
      fileCount: 12,
      totalBytes: 1024,
    });

    const result = await backfillSourceSnapshots();

    expect(productVersionFindManyMock).toHaveBeenCalledWith({
      where: { status: 'published' },
      include: {
        product: {
          select: { key: true, ownerId: true },
        },
        sourceSnapshot: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(getVersionSourceArchiveMock).toHaveBeenCalledTimes(2);
    expect(getVersionSourceArchiveMock).toHaveBeenNthCalledWith(1, 'user-1', 11);
    expect(getVersionSourceArchiveMock).toHaveBeenNthCalledWith(2, 'user-1', 12);

    const extractDirArg = extractZipToTempMock.mock.calls[0]?.[1];
    expect(extractZipToTempMock).toHaveBeenCalledWith('C:/archives/crm-v1.1.0.zip', expect.any(String));
    expect(typeof extractDirArg).toBe('string');
    expect(path.basename(extractDirArg)).toBe('extract');
    expect(path.dirname(extractDirArg)).toContain('source-snapshot-backfill-');
    expect(findFileRootMock).toHaveBeenCalledWith(extractDirArg, 'package.json');

    expect(createSourceSnapshotMock).toHaveBeenCalledTimes(1);
    expect(createSourceSnapshotMock).toHaveBeenCalledWith({
      userId: 'user-1',
      versionId: 11,
      productKey: 'crm',
      version: 'v1.1.0',
      sourceDir: path.join(extractDirArg, 'project'),
    });
    expect(result).toEqual({
      scanned: 3,
      skippedReady: 1,
      skippedMissingArchive: 1,
      skippedMissingProjectRoot: 0,
      generated: 1,
      failed: 0,
    });
  });

  test('skips snapshot creation when archive extracts but package root cannot be found', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 21,
        version: 'v2.0.0',
        status: 'published',
        product: { key: 'erp', ownerId: 'user-2' },
        sourceSnapshot: { status: 'failed' },
      },
    ]);
    getVersionSourceArchiveMock.mockResolvedValue({
      fileName: 'erp-v2.0.0.zip',
      filePath: 'C:/archives/erp-v2.0.0.zip',
    });
    findFileRootMock.mockResolvedValue(null);

    const result = await backfillSourceSnapshots();

    expect(getVersionSourceArchiveMock).toHaveBeenCalledTimes(1);
    expect(getVersionSourceArchiveMock).toHaveBeenCalledWith('user-2', 21);
    expect(extractZipToTempMock).toHaveBeenCalledWith('C:/archives/erp-v2.0.0.zip', expect.any(String));
    expect(findFileRootMock).toHaveBeenCalledWith(expect.stringContaining(`${path.sep}extract`), 'package.json');
    expect(createSourceSnapshotMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 1,
      skippedReady: 0,
      skippedMissingArchive: 0,
      skippedMissingProjectRoot: 1,
      generated: 0,
      failed: 0,
    });
  });

  test('continues processing when getVersionSourceArchive fails for one version', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 31,
        version: 'v3.1.0',
        status: 'published',
        product: { key: 'crm', ownerId: 'user-1' },
        sourceSnapshot: null,
      },
      {
        id: 32,
        version: 'v3.2.0',
        status: 'published',
        product: { key: 'crm', ownerId: 'user-1' },
        sourceSnapshot: null,
      },
    ]);
    getVersionSourceArchiveMock.mockImplementation(async (userId: string, versionId: number) => {
      if (userId === 'user-1' && versionId === 31) {
        throw new Error('archive lookup failed');
      }

      return {
        fileName: 'crm-v3.2.0.zip',
        filePath: 'C:/archives/crm-v3.2.0.zip',
      };
    });
    findFileRootMock.mockImplementation(async (extractDir: string) => path.join(extractDir, 'project'));
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/crm/v3.2.0',
      fileCount: 8,
      totalBytes: 900,
    });

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const result = await backfillSourceSnapshots(logger);

    expect(getVersionSourceArchiveMock).toHaveBeenCalledTimes(2);
    expect(createSourceSnapshotMock).toHaveBeenCalledTimes(1);
    expect(createSourceSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        versionId: 32,
        productKey: 'crm',
        version: 'v3.2.0',
      }),
    );
    expect(result).toEqual({
      scanned: 2,
      skippedReady: 0,
      skippedMissingArchive: 0,
      skippedMissingProjectRoot: 0,
      generated: 1,
      failed: 1,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  test('continues processing when temp directory creation fails for one version', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 41,
        version: 'v4.1.0',
        status: 'published',
        product: { key: 'erp', ownerId: 'user-2' },
        sourceSnapshot: null,
      },
      {
        id: 42,
        version: 'v4.2.0',
        status: 'published',
        product: { key: 'erp', ownerId: 'user-2' },
        sourceSnapshot: null,
      },
    ]);
    getVersionSourceArchiveMock.mockResolvedValue({
      fileName: 'erp.zip',
      filePath: 'C:/archives/erp.zip',
    });
    findFileRootMock.mockImplementation(async (extractDir: string) => path.join(extractDir, 'project'));
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/erp/v4.2.0',
      fileCount: 5,
      totalBytes: 321,
    });

    const originalMkdtemp = fs.mkdtemp;
    vi.spyOn(fs, 'mkdtemp')
      .mockRejectedValueOnce(new Error('mkdtemp failed'))
      .mockImplementationOnce((prefix: string) => originalMkdtemp(prefix));

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const result = await backfillSourceSnapshots(logger);

    expect(getVersionSourceArchiveMock).toHaveBeenCalledTimes(2);
    expect(createSourceSnapshotMock).toHaveBeenCalledTimes(1);
    expect(createSourceSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        versionId: 42,
        productKey: 'erp',
        version: 'v4.2.0',
      }),
    );
    expect(result).toEqual({
      scanned: 2,
      skippedReady: 0,
      skippedMissingArchive: 0,
      skippedMissingProjectRoot: 0,
      generated: 1,
      failed: 1,
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
