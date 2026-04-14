import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  spawnMock,
  readFileMock,
  writeFileMock,
  createWriteStreamMock,
  detectPackageManagerMock,
  normalizeBuildOutputPathsMock,
  validateBuildOutputMock,
  extractZipToTempMock,
  findFileRootMock,
  publishExtractedDirMock,
  createSourceSnapshotMock,
  scheduleSourceSnapshotIndexBuildMock,
  uploadRecordFindUniqueMock,
  uploadRecordUpdateMock,
  productVersionFindFirstMock,
  txProductVersionFindFirstMock,
  txProductVersionUpdateManyMock,
  txProductVersionUpdateMock,
  txUploadRecordFindUniqueOrThrowMock,
  txUploadRecordUpdateMock,
  transactionMock,
  ensureDirMock,
  removeMock,
} = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  createWriteStreamMock: vi.fn(),
  detectPackageManagerMock: vi.fn(),
  normalizeBuildOutputPathsMock: vi.fn(),
  validateBuildOutputMock: vi.fn(),
  extractZipToTempMock: vi.fn(),
  findFileRootMock: vi.fn(),
  publishExtractedDirMock: vi.fn(),
  createSourceSnapshotMock: vi.fn(),
  scheduleSourceSnapshotIndexBuildMock: vi.fn(),
  uploadRecordFindUniqueMock: vi.fn(),
  uploadRecordUpdateMock: vi.fn(),
  productVersionFindFirstMock: vi.fn(),
  txProductVersionFindFirstMock: vi.fn(),
  txProductVersionUpdateManyMock: vi.fn(),
  txProductVersionUpdateMock: vi.fn(),
  txUploadRecordFindUniqueOrThrowMock: vi.fn(),
  txUploadRecordUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  ensureDirMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
    writeFile: writeFileMock,
  },
  readFile: readFileMock,
  writeFile: writeFileMock,
}));

vi.mock('node:fs', () => ({
  createWriteStream: createWriteStreamMock,
}));

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: ensureDirMock,
    remove: removeMock,
  },
}));

vi.mock('@/lib/server/fs-utils', () => ({
  ensureAppDirectories: vi.fn(),
  extractZipToTemp: extractZipToTempMock,
  findFileRoot: findFileRootMock,
  publishExtractedDir: publishExtractedDirMock,
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  createSourceSnapshot: createSourceSnapshotMock,
  scheduleSourceSnapshotIndexBuild: scheduleSourceSnapshotIndexBuildMock,
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
    normalizeBuildOutputPaths: normalizeBuildOutputPathsMock,
    validateBuildOutput: validateBuildOutputMock,
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

function createSuccessfulChild(output: string) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  queueMicrotask(() => {
    child.stdout.emit('data', Buffer.from(output));
    child.emit('close', 0);
  });

  return child;
}

describe('build-job-service source snapshot integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __buildJobQueueState__?: unknown }).__buildJobQueueState__;

    createWriteStreamMock.mockImplementation(() => ({
      write: vi.fn(),
      once: vi.fn(),
      end: (callback?: () => void) => callback?.(),
    }));
    spawnMock.mockImplementation((command: string) => createSuccessfulChild(`${command} success`));
    readFileMock.mockImplementation(async (targetPath: string) => {
      if (String(targetPath).endsWith('package.json')) {
        return JSON.stringify({
          name: 'crm-web',
          scripts: { build: 'vite build' },
        });
      }

      throw new Error(`unexpected read: ${targetPath}`);
    });
    writeFileMock.mockResolvedValue(undefined);
    ensureDirMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    extractZipToTempMock.mockResolvedValue(undefined);
    findFileRootMock.mockResolvedValue('/tmp/project-root');
    publishExtractedDirMock.mockResolvedValue('C:/published/crm/v1.0.0');
    createSourceSnapshotMock.mockRejectedValue(new Error('snapshot generation failed'));
    scheduleSourceSnapshotIndexBuildMock.mockResolvedValue(undefined);
    detectPackageManagerMock.mockResolvedValue('pnpm');
    normalizeBuildOutputPathsMock.mockResolvedValue({ rewritten: false, rewrittenCount: 0, rewrittenFilesCount: 0 });
    validateBuildOutputMock.mockResolvedValue(undefined);

    const job = {
      id: 7,
      userId: 'user-1',
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

    txUploadRecordFindUniqueOrThrowMock.mockResolvedValue({
      id: 7,
      userId: 'user-1',
      productKey: 'crm',
      version: 'v1.0.0',
    });
    txProductVersionFindFirstMock.mockResolvedValue({ id: 701, productId: 99 });
    txProductVersionUpdateManyMock.mockResolvedValue({ count: 1 });
    txProductVersionUpdateMock.mockResolvedValue({});
    txUploadRecordUpdateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        productVersion: {
          findFirst: txProductVersionFindFirstMock,
          updateMany: txProductVersionUpdateManyMock,
          update: txProductVersionUpdateMock,
        },
        uploadRecord: {
          findUniqueOrThrow: txUploadRecordFindUniqueOrThrowMock,
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
      userId: 'user-1',
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
    expect(scheduleSourceSnapshotIndexBuildMock).not.toHaveBeenCalled();
  });

  test('schedules source index creation only after publish succeeds', async () => {
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/crm/v1.0.0',
      fileCount: 12,
      totalBytes: 2048,
    });

    scheduleBuildJob(7);

    await waitUntil(() => {
      expect(scheduleSourceSnapshotIndexBuildMock).toHaveBeenCalledTimes(1);
    });

    expect(scheduleSourceSnapshotIndexBuildMock).toHaveBeenCalledWith(701);
    expect(txProductVersionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 701 },
        data: expect.objectContaining({
          status: 'published',
        }),
      }),
    );
    expect(scheduleSourceSnapshotIndexBuildMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      txProductVersionUpdateMock.mock.invocationCallOrder[0],
    );
  });

  test('keeps build success when post-publish scheduling throws synchronously', async () => {
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/source-snapshots/crm/v1.0.0',
      fileCount: 12,
      totalBytes: 2048,
    });
    scheduleSourceSnapshotIndexBuildMock.mockImplementationOnce(() => {
      throw new Error('schedule failed');
    });

    scheduleBuildJob(7);

    await waitUntil(() => {
      expect(scheduleSourceSnapshotIndexBuildMock).toHaveBeenCalledTimes(1);
    });

    expect(txUploadRecordUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: 'success',
        }),
      }),
    );
    expect(txUploadRecordUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: 'failed',
        }),
      }),
    );
  });
});
