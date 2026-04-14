import { beforeEach, describe, expect, test, vi } from 'vitest';

const { productVersionFindManyMock, rebuildSourceSnapshotIndexMock } = vi.hoisted(() => ({
  productVersionFindManyMock: vi.fn(),
  rebuildSourceSnapshotIndexMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVersion: {
      findMany: productVersionFindManyMock,
    },
  },
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  rebuildSourceSnapshotIndex: rebuildSourceSnapshotIndexMock,
}));

import { backfillSourceIndexes } from '@/scripts/backfill-source-indexes';

describe('backfillSourceIndexes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rebuilds indexes only for published versions with ready snapshots and missing/unready index state', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 10,
        version: 'v1.0.0',
        product: { key: 'crm' },
        sourceSnapshot: { id: 100, status: 'ready', indexStatus: 'ready', indexArtifacts: [{ id: 9001 }] },
      },
      {
        id: 11,
        version: 'v1.1.0',
        product: { key: 'crm' },
        sourceSnapshot: { id: 101, status: 'ready', indexStatus: 'pending', indexArtifacts: [] },
      },
      {
        id: 12,
        version: 'v1.2.0',
        product: { key: 'crm' },
        sourceSnapshot: { id: 102, status: 'ready', indexStatus: 'failed', indexArtifacts: [{ id: 9002 }] },
      },
      {
        id: 13,
        version: 'v1.3.0',
        product: { key: 'crm' },
        sourceSnapshot: { id: 103, status: 'ready', indexStatus: 'ready', indexArtifacts: [] },
      },
      {
        id: 14,
        version: 'v1.4.0',
        product: { key: 'crm' },
        sourceSnapshot: null,
      },
    ]);
    rebuildSourceSnapshotIndexMock.mockResolvedValue(undefined);

    const result = await backfillSourceIndexes();

    expect(productVersionFindManyMock).toHaveBeenCalledWith({
      where: { status: 'published' },
      include: {
        product: {
          select: { key: true },
        },
        sourceSnapshot: {
          select: {
            id: true,
            status: true,
            indexStatus: true,
            indexArtifacts: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(rebuildSourceSnapshotIndexMock).toHaveBeenCalledTimes(3);
    expect(rebuildSourceSnapshotIndexMock).toHaveBeenNthCalledWith(1, 11);
    expect(rebuildSourceSnapshotIndexMock).toHaveBeenNthCalledWith(2, 12);
    expect(rebuildSourceSnapshotIndexMock).toHaveBeenNthCalledWith(3, 13);
    expect(result).toEqual({
      scanned: 5,
      skippedSnapshotNotReady: 1,
      skippedIndexReady: 1,
      rebuilt: 3,
      failed: 0,
    });
  });

  test('continues processing when one source index rebuild fails', async () => {
    productVersionFindManyMock.mockResolvedValue([
      {
        id: 21,
        version: 'v2.1.0',
        product: { key: 'erp' },
        sourceSnapshot: { id: 201, status: 'ready', indexStatus: 'pending', indexArtifacts: [] },
      },
      {
        id: 22,
        version: 'v2.2.0',
        product: { key: 'erp' },
        sourceSnapshot: { id: 202, status: 'ready', indexStatus: 'pending', indexArtifacts: [] },
      },
    ]);
    rebuildSourceSnapshotIndexMock
      .mockRejectedValueOnce(new Error('intentional rebuild failure'))
      .mockResolvedValueOnce(undefined);

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const result = await backfillSourceIndexes(logger);

    expect(rebuildSourceSnapshotIndexMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      scanned: 2,
      skippedSnapshotNotReady: 0,
      skippedIndexReady: 0,
      rebuilt: 1,
      failed: 1,
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
