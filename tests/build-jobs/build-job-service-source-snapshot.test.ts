import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  detectPackageManagerMock,
  extractZipToTempMock,
  findFileRootMock,
  createSourceSnapshotMock,
  uploadRecordFindUniqueMock,
  uploadRecordUpdateMock,
  productVersionFindFirstMock,
  txProductVersionFindFirstMock,
  txProductVersionUpdateMock,
  txUploadRecordUpdateMock,
  transactionMock,
  ensureDirMock,
} = vi.hoisted(() => ({
  detectPackageManagerMock: vi.fn(),
  extractZipToTempMock: vi.fn(),
  findFileRootMock: vi.fn(),
  createSourceSnapshotMock: vi.fn(),
  uploadRecordFindUniqueMock: vi.fn(),
  uploadRecordUpdateMock: vi.fn(),
  productVersionFindFirstMock: vi.fn(),
  txProductVersionFindFirstMock: vi.fn(),
  txProductVersionUpdateMock: vi.fn(),
  txUploadRecordUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  ensureDirMock: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: ensureDirMock,
    remove: vi.fn(),
  },
}));

vi.mock('@/lib/server/fs-utils', () => ({
  ensureAppDirectories: vi.fn(),
  extractZipToTemp: extractZipToTempMock,
  findFileRoot: findFileRootMock,
  publishExtractedDir: vi.fn(),
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  createSourceSnapshot: createSourceSnapshotMock,
}));

vi.mock('@/lib/server/build-job-log-stream', () => ({
  createBuildJobLogStreamResponse: vi.fn(),
  publishBuildJobLogChunk: vi.fn(),
  publishBuildJobLogStatus: vi.fn(),
}));

vi.mock('@/lib/server/serializers', () => ({
  serializeUploadRecord: vi.fn((record: unknown) => record),
}));

vi.mock('@/lib/domain/build-job', async () => {
  const actual = await vi.importActual<typeof import('@/lib/domain/build-job')>('@/lib/domain/build-job');
  return {
    ...actual,
    detectPackageManager: detectPackageManagerMock,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadRecord: {
      findUnique: uploadRecordFindUniqueMock,
      update: uploadRecordUpdateMock,
      findMany: vi.fn(),
      create: vi.fn(),
    },
    productVersion: {
      findFirst: productVersionFindFirstMock,
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    $transaction: transactionMock,
  },
}));

import { buildInitialJobSteps, stringifyJobSteps } from '@/lib/domain/build-job';
import { scheduleBuildJob } from '@/lib/server/build-job-service';

async function waitUntil(assertion: () => void, timeoutMs = 2000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('timed out waiting for async assertion');
}

describe('build-job-service source snapshot integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __buildJobQueueState__?: unknown }).__buildJobQueueState__;

    ensureDirMock.mockResolvedValue(undefined);
    extractZipToTempMock.mockResolvedValue(undefined);
    findFileRootMock.mockResolvedValue('/tmp/project-root');
    createSourceSnapshotMock.mockRejectedValue(new Error('snapshot generation failed'));
    detectPackageManagerMock.mockResolvedValue('pnpm');

    const job = {
      id: 7,
      productKey: 'crm',
      version: 'v1.0.0',
      fileName: 'crm-v1.zip',
      stepsJson: stringifyJobSteps(buildInitialJobSteps()),
      currentStep: 'extract',
      createdAt: new Date('2026-04-08T00:00:00.000Z'),
    };
    uploadRecordFindUniqueMock.mockResolvedValue(job);
    uploadRecordUpdateMock.mockResolvedValue({});
    productVersionFindFirstMock.mockResolvedValue({ id: 701 });

    txProductVersionFindFirstMock.mockResolvedValue({ id: 701 });
    txProductVersionUpdateMock.mockResolvedValue({});
    txUploadRecordUpdateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        productVersion: {
          findFirst: txProductVersionFindFirstMock,
          update: txProductVersionUpdateMock,
        },
        uploadRecord: {
          update: txUploadRecordUpdateMock,
        },
      }),
    );
  });

  test('fails early when snapshot generation fails, before package-manager detection/install', async () => {
    scheduleBuildJob(7);

    await waitUntil(() => {
      expect(createSourceSnapshotMock).toHaveBeenCalledTimes(1);
    });

    expect(findFileRootMock).toHaveBeenCalledWith(expect.stringContaining('workspace'), 'package.json');
    expect(createSourceSnapshotMock).toHaveBeenCalledWith({
      versionId: 701,
      productKey: 'crm',
      version: 'v1.0.0',
      sourceDir: '/tmp/project-root',
    });
    expect(detectPackageManagerMock).not.toHaveBeenCalled();
    expect(txUploadRecordUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: 'failed',
        }),
      }),
    );
  });

  test('continues to package-manager detection after snapshot generation succeeds', async () => {
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/crm/v1.0.0',
      fileCount: 12,
      totalBytes: 2048,
    });
    detectPackageManagerMock.mockRejectedValue(new Error('intentional detect failure'));

    scheduleBuildJob(7);

    await waitUntil(() => {
      expect(detectPackageManagerMock).toHaveBeenCalledTimes(1);
    });

    expect(createSourceSnapshotMock).toHaveBeenCalledTimes(1);
    expect(createSourceSnapshotMock.mock.invocationCallOrder[0]).toBeLessThan(detectPackageManagerMock.mock.invocationCallOrder[0]);
    expect(detectPackageManagerMock).toHaveBeenCalledWith('/tmp/project-root');
    expect(txUploadRecordUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: 'failed',
        }),
      }),
    );
  });
});
