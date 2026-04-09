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
  ensureAppDirectoriesMock,
  extractZipToTempMock,
  findFileRootMock,
  publishExtractedDirMock,
  createSourceSnapshotMock,
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
  ensureAppDirectoriesMock: vi.fn(),
  extractZipToTempMock: vi.fn(),
  findFileRootMock: vi.fn(),
  publishExtractedDirMock: vi.fn(),
  createSourceSnapshotMock: vi.fn(),
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

vi.mock('@/lib/config', () => ({
  appConfig: {
    uploadMaxBytes: 200 * 1024 * 1024,
    buildJobsDir: 'C:/build-jobs',
    prototypesDir: 'C:/prototypes',
  },
}));

vi.mock('@/lib/server/fs-utils', () => ({
  ensureAppDirectories: ensureAppDirectoriesMock,
  extractZipToTemp: extractZipToTempMock,
  findFileRoot: findFileRootMock,
  publishExtractedDir: publishExtractedDirMock,
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
    normalizeBuildOutputPaths: normalizeBuildOutputPathsMock,
    validateBuildOutput: validateBuildOutputMock,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadRecord: {
      findUnique: uploadRecordFindUniqueMock,
      update: uploadRecordUpdateMock,
      create: vi.fn(),
    },
    productVersion: {
      findFirst: productVersionFindFirstMock,
      create: vi.fn(),
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

describe('build-job-service default version promotion', () => {
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
    ensureAppDirectoriesMock.mockResolvedValue(undefined);
    extractZipToTempMock.mockResolvedValue(undefined);
    findFileRootMock.mockResolvedValue('C:/build-jobs/7/workspace/extract/project');
    publishExtractedDirMock.mockResolvedValue('C:/prototypes/crm/v2.0.0');
    createSourceSnapshotMock.mockResolvedValue({
      rootPath: 'C:/snapshots/crm/v2.0.0',
      fileCount: 8,
      totalBytes: 1024,
    });
    detectPackageManagerMock.mockResolvedValue('pnpm');
    normalizeBuildOutputPathsMock.mockResolvedValue({ rewritten: false, rewrittenCount: 0 });
    validateBuildOutputMock.mockResolvedValue(undefined);

    uploadRecordFindUniqueMock.mockResolvedValue({
      id: 7,
      productKey: 'crm',
      version: 'v2.0.0',
      fileName: 'crm-v2.zip',
      stepsJson: stringifyJobSteps(buildInitialJobSteps()),
      currentStep: 'extract',
      createdAt: new Date('2026-04-09T00:00:00.000Z'),
    });
    uploadRecordUpdateMock.mockResolvedValue({});
    productVersionFindFirstMock.mockResolvedValue({ id: 702 });

    txUploadRecordFindUniqueOrThrowMock.mockResolvedValue({
      id: 7,
      productKey: 'crm',
      version: 'v2.0.0',
    });
    txProductVersionFindFirstMock
      .mockResolvedValueOnce({ id: 702, productId: 1 })
      .mockResolvedValueOnce({ id: 701, productId: 1, status: 'published' });
    txProductVersionUpdateManyMock.mockResolvedValue({ count: 2 });
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

  test('promotes the newly published version to default even when another published version already exists', async () => {
    scheduleBuildJob(7);

    await waitUntil(() => {
      expect(txProductVersionUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 702 },
          data: expect.objectContaining({
            status: 'published',
            isDefault: true,
          }),
        }),
      );
    });

    expect(txProductVersionUpdateManyMock).toHaveBeenCalledWith({
      where: { productId: 1 },
      data: { isDefault: false },
    });
    expect(txUploadRecordUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: 'success',
        }),
      }),
    );
  });
});
