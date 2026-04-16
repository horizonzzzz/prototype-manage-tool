import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
  sourceSnapshotUpsertMock,
  sourceSnapshotFindUniqueMock,
  sourceSnapshotFindManyMock,
  sourceSnapshotUpdateManyMock,
  sourceSnapshotUpdateMock,
  sourceIndexArtifactDeleteManyMock,
  sourceIndexArtifactCreateMock,
  productFindManyMock,
  productVersionFindManyMock,
  productVersionFindFirstMock,
  transactionMock,
} = vi.hoisted(() => ({
  sourceSnapshotUpsertMock: vi.fn(),
  sourceSnapshotFindUniqueMock: vi.fn(),
  sourceSnapshotFindManyMock: vi.fn(),
  sourceSnapshotUpdateManyMock: vi.fn(),
  sourceSnapshotUpdateMock: vi.fn(),
  sourceIndexArtifactDeleteManyMock: vi.fn(),
  sourceIndexArtifactCreateMock: vi.fn(),
  productFindManyMock: vi.fn(),
  productVersionFindManyMock: vi.fn(),
  productVersionFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
}));

const testState = vi.hoisted(() => ({
  sourceSnapshotsDir: '',
}));

vi.mock('@/lib/config', () => ({
  appConfig: {
    get sourceSnapshotsDir() {
      return testState.sourceSnapshotsDir;
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: productFindManyMock,
    },
    productVersion: {
      findMany: productVersionFindManyMock,
      findFirst: productVersionFindFirstMock,
    },
    sourceSnapshot: {
      findMany: sourceSnapshotFindManyMock,
      findUnique: sourceSnapshotFindUniqueMock,
      upsert: sourceSnapshotUpsertMock,
      update: sourceSnapshotUpdateMock,
      updateMany: sourceSnapshotUpdateManyMock,
    },
    sourceIndexArtifact: {
      deleteMany: sourceIndexArtifactDeleteManyMock,
      create: sourceIndexArtifactCreateMock,
    },
    $transaction: transactionMock,
  },
}));

import {
  createSourceSnapshot,
  ensureSourceIndexBackfillScheduled,
  startSourceIndexBackfillLoop,
  rebuildSourceSnapshotIndex,
  __resetSourceIndexQueueState,
  deleteSourceIndexForVersion,
  deleteSourceIndexesForProduct,
  deleteSourceSnapshotForVersion,
  deleteSourceSnapshotsForProduct,
  getSourceTree,
  listPublishedSnapshotProducts,
  listPublishedSnapshotVersions,
  readSourceFile,
  resolvePublishedSnapshotVersion,
  searchSourceFiles,
} from '@/lib/server/source-snapshot-service';

const mcpAccessScope = {
  userId: 'user-1',
  apiKeyId: 101,
  allowedProductIds: [11],
};

const SOURCE_SNAPSHOT_INTEGRATION_TIMEOUT_MS = 30_000;

describe('source snapshot service', { timeout: SOURCE_SNAPSHOT_INTEGRATION_TIMEOUT_MS }, () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    sourceSnapshotUpsertMock.mockResolvedValue({});
    sourceSnapshotFindManyMock.mockResolvedValue([]);
    sourceSnapshotFindUniqueMock.mockResolvedValue(null);
    sourceSnapshotUpdateManyMock.mockResolvedValue({ count: 1 });
    sourceSnapshotUpdateMock.mockResolvedValue({});
    sourceIndexArtifactDeleteManyMock.mockResolvedValue({ count: 0 });
    sourceIndexArtifactCreateMock.mockResolvedValue({});
    productFindManyMock.mockResolvedValue([]);
    productVersionFindManyMock.mockResolvedValue([]);
    productVersionFindFirstMock.mockResolvedValue(null);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        sourceSnapshot: {
          update: sourceSnapshotUpdateMock,
        },
        sourceIndexArtifact: {
          deleteMany: sourceIndexArtifactDeleteManyMock,
          create: sourceIndexArtifactCreateMock,
        },
      }),
    );
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-snapshot-service-'));
    testState.sourceSnapshotsDir = path.join(tmpDir, 'source-snapshots');
    __resetSourceIndexQueueState();
    delete (globalThis as typeof globalThis & { __sourceIndexQueueState__?: unknown }).__sourceIndexQueueState__;
    delete (globalThis as typeof globalThis & { __sourceIndexBackfillState__?: unknown }).__sourceIndexBackfillState__;
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  test('creates filtered snapshot and records metadata', async () => {
    const sourceDir = path.join(tmpDir, 'source');
    await fse.ensureDir(sourceDir);
    await fs.writeFile(path.join(sourceDir, 'README.md'), 'keep');
    await fse.ensureDir(path.join(sourceDir, 'src'));
    await fs.writeFile(path.join(sourceDir, 'src', 'index.ts'), 'keep');
    await fse.ensureDir(path.join(sourceDir, 'node_modules'));
    await fs.writeFile(path.join(sourceDir, 'node_modules', 'lib.js'), 'skip');
    await fse.ensureDir(path.join(sourceDir, '.git'));
    await fs.writeFile(path.join(sourceDir, '.git', 'config'), 'skip');
    await fse.ensureDir(path.join(sourceDir, '.next'));
    await fs.writeFile(path.join(sourceDir, '.next', 'build.js'), 'skip');
    await fse.ensureDir(path.join(sourceDir, 'dist'));
    await fs.writeFile(path.join(sourceDir, 'dist', 'main.js'), 'skip');
    await fse.ensureDir(path.join(sourceDir, 'build'));
    await fs.writeFile(path.join(sourceDir, 'build', 'main.js'), 'skip');
    await fse.ensureDir(path.join(sourceDir, 'coverage'));
    await fs.writeFile(path.join(sourceDir, 'coverage', 'lcov.info'), 'skip');

    await createSourceSnapshot({
      userId: 'user-1',
      versionId: 1001,
      productKey: 'crm',
      version: 'v1.2.3',
      sourceDir,
    });

    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.2.3');
    await expect(fse.pathExists(path.join(snapshotDir, 'README.md'))).resolves.toBe(true);
    await expect(fse.pathExists(path.join(snapshotDir, 'src', 'index.ts'))).resolves.toBe(true);
    await expect(fse.pathExists(path.join(snapshotDir, 'node_modules'))).resolves.toBe(false);
    await expect(fse.pathExists(path.join(snapshotDir, '.git'))).resolves.toBe(false);
    await expect(fse.pathExists(path.join(snapshotDir, '.next'))).resolves.toBe(false);
    await expect(fse.pathExists(path.join(snapshotDir, 'dist'))).resolves.toBe(false);
    await expect(fse.pathExists(path.join(snapshotDir, 'build'))).resolves.toBe(false);
    await expect(fse.pathExists(path.join(snapshotDir, 'coverage'))).resolves.toBe(false);

    expect(sourceSnapshotUpsertMock).toHaveBeenCalledWith({
      where: { versionId: 1001 },
      create: {
        versionId: 1001,
        status: 'ready',
        indexStatus: 'pending',
        rootPath: snapshotDir,
        fileCount: 2,
        totalBytes: 8,
        generatedAt: expect.any(Date),
        errorMessage: null,
        indexGeneratedAt: null,
        indexErrorMessage: null,
      },
      update: {
        status: 'ready',
        indexStatus: 'pending',
        rootPath: snapshotDir,
        fileCount: 2,
        totalBytes: 8,
        generatedAt: expect.any(Date),
        errorMessage: null,
        indexGeneratedAt: null,
        indexErrorMessage: null,
      },
    });
  });

  test('deletes one version snapshot by version path', async () => {
    const targetDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    const keepDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v2.0.0');
    await fse.ensureDir(targetDir);
    await fse.ensureDir(keepDir);
    await fs.writeFile(path.join(targetDir, 'a.txt'), 'to-delete');
    await fs.writeFile(path.join(keepDir, 'a.txt'), 'keep');

    await deleteSourceSnapshotForVersion('user-1', 'crm', 'v1.0.0');

    await expect(fse.pathExists(targetDir)).resolves.toBe(false);
    await expect(fse.pathExists(keepDir)).resolves.toBe(true);
  });

  test('deletes all version snapshots for a product', async () => {
    const productDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm');
    const otherProductDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'erp');
    await fse.ensureDir(path.join(productDir, 'v1.0.0'));
    await fse.ensureDir(path.join(productDir, 'v2.0.0'));
    await fse.ensureDir(path.join(otherProductDir, 'v1.0.0'));
    await fs.writeFile(path.join(productDir, 'v1.0.0', 'a.txt'), 'to-delete');
    await fs.writeFile(path.join(otherProductDir, 'v1.0.0', 'a.txt'), 'keep');

    await deleteSourceSnapshotsForProduct('user-1', 'crm');

    await expect(fse.pathExists(productDir)).resolves.toBe(false);
    await expect(fse.pathExists(otherProductDir)).resolves.toBe(true);
  });

  test('deletes source index records for one version', async () => {
    await deleteSourceIndexForVersion('user-1', 'crm', 'v1.0.0');

    expect(sourceIndexArtifactDeleteManyMock).toHaveBeenCalledWith({
      where: {
        snapshot: {
          version: {
            version: 'v1.0.0',
            product: {
              key: 'crm',
              ownerId: 'user-1',
            },
          },
        },
      },
    });
  });

  test('deletes source index records for all versions under a product', async () => {
    await deleteSourceIndexesForProduct('user-1', 'crm');

    expect(sourceIndexArtifactDeleteManyMock).toHaveBeenCalledWith({
      where: {
        snapshot: {
          version: {
            product: {
              key: 'crm',
              ownerId: 'user-1',
            },
          },
        },
      },
    });
  });

  test('rebuilds source index by versionId and applies indexing -> ready lifecycle', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fs.writeFile(
      path.join(snapshotDir, 'package.json'),
      JSON.stringify(
        {
          name: 'crm-ui',
          dependencies: {
            react: '^19.0.0',
            'react-router-dom': '^7.0.0',
          },
          devDependencies: {
            vite: '^6.0.0',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'App.tsx'),
      'import { BrowserRouter } from "react-router-dom";\n' +
        'import { Button } from "./components/Button";\n' +
        'export function App() { return <BrowserRouter><Button /></BrowserRouter>; }\n',
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'components', 'Button.tsx'), 'export function Button() { return <button />; }\n');
    await fs.writeFile(path.join(snapshotDir, 'src', 'types.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(path.join(snapshotDir, 'src', 'mocks.ts'), 'export const mockUsers = [{ id: "u-1" }];\n');

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5001,
      status: 'ready',
      rootPath: snapshotDir,
    });

    await rebuildSourceSnapshotIndex(701);

    expect(sourceSnapshotFindUniqueMock).toHaveBeenCalledWith({
      where: { versionId: 701 },
      select: {
        id: true,
        status: true,
        rootPath: true,
      },
    });
    expect(sourceSnapshotUpdateMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 5001 },
        data: {
          indexStatus: 'indexing',
          indexGeneratedAt: null,
          indexErrorMessage: null,
        },
      }),
    );
    expect(sourceIndexArtifactDeleteManyMock).toHaveBeenCalledWith({
      where: {
        snapshotId: 5001,
        artifactKey: 'source-tree-v2',
      },
    });
    expect(sourceIndexArtifactCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotId: 5001,
          artifactKey: 'source-tree-v2',
          contentJson: expect.any(String),
          status: 'ready',
          generatedAt: expect.any(Date),
          errorMessage: null,
        }),
      }),
    );
    expect(sourceSnapshotUpdateMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 5001 },
        data: expect.objectContaining({
          indexStatus: 'ready',
          indexGeneratedAt: expect.any(Date),
          indexErrorMessage: null,
        }),
      }),
    );
    expect(sourceSnapshotUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(sourceSnapshotUpdateMock.mock.invocationCallOrder[1]);

    const createPayload = sourceIndexArtifactCreateMock.mock.calls[0]?.[0];
    const parsedArtifact = JSON.parse(createPayload.data.contentJson as string) as Record<string, unknown>;
    expect(parsedArtifact).toMatchObject({
      format: 'source-tree-v2',
      snapshotVersionId: 701,
      summary: expect.objectContaining({
        frameworkHints: expect.arrayContaining(['react', 'vite']),
        routingMode: 'react-router',
      }),
      files: expect.arrayContaining([
        expect.objectContaining({
          path: 'src/App.tsx',
          ext: '.tsx',
          imports: ['react-router-dom', './components/Button'],
          localDependencies: ['src/components/Button.tsx'],
        }),
        expect.objectContaining({
          path: 'src/types.ts',
          ext: '.ts',
          imports: [],
          localDependencies: [],
        }),
      ]),
    });
    expect(
      ((parsedArtifact.files as Array<Record<string, unknown>>) ?? []).every(
        (file) => !('exports' in file) && !('importEntries' in file) && !('reExportEntries' in file) && !('symbols' in file),
      ),
    ).toBe(true);
    expect(
      ((parsedArtifact.definitions as Array<Record<string, unknown>>) ?? []).every(
        (definition) => !('definitionId' in definition),
      ),
    ).toBe(true);
    expect(
      ((parsedArtifact.usages as Array<Record<string, unknown>>) ?? []).every(
        (usage) => !('fromFilePath' in usage) && !('toFilePath' in usage),
      ),
    ).toBe(true);
  });

  test('rebuilds source index with tsconfig alias paths, baseUrl imports, and typed arrow components', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.1');
    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'types'));
    await fs.writeFile(
      path.join(snapshotDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: 'src',
            paths: {
              '@/*': ['*'],
            },
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Button.tsx'),
      'import type { User } from "types/model";\n' +
        'export const Button: React.FC<{ user?: User }> = () => <button />;\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'feature.tsx'),
      'import { Button } from "@/components/Button";\n' +
        'import type { User } from "@/types/model";\n' +
        'const users: User[] = [];\n' +
        'export function Feature() { return <Button user={users[0]} />; }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'base-url-feature.tsx'),
      'import { Button } from "components/Button";\n' +
        'import type { User } from "types/model";\n' +
        'const users: User[] = [];\n' +
        'export const BaseUrlFeature = () => <Button user={users[0]} />;\n',
    );

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5003,
      status: 'ready',
      rootPath: snapshotDir,
    });

    await rebuildSourceSnapshotIndex(703);

    const createPayload = sourceIndexArtifactCreateMock.mock.calls[0]?.[0];
    const parsedArtifact = JSON.parse(createPayload.data.contentJson as string) as {
      files: Array<{
        path: string;
        ext: string;
        localDependencies: string[];
        imports: string[];
      }>;
    };

    expect(parsedArtifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/components/Button.tsx',
          ext: '.tsx',
          imports: ['types/model'],
          localDependencies: ['src/types/model.ts'],
        }),
        expect.objectContaining({
          path: 'src/feature.tsx',
          ext: '.tsx',
          imports: ['@/components/Button', '@/types/model'],
          localDependencies: ['src/components/Button.tsx', 'src/types/model.ts'],
        }),
        expect.objectContaining({
          path: 'src/base-url-feature.tsx',
          ext: '.tsx',
          imports: ['components/Button', 'types/model'],
          localDependencies: ['src/components/Button.tsx', 'src/types/model.ts'],
        }),
      ]),
    );
    expect(
      parsedArtifact.files.every(
        (file) => !('exports' in file) && !('importEntries' in file) && !('reExportEntries' in file) && !('symbols' in file),
      ),
    ).toBe(true);
  });

  test('rebuilds source index with JSONC tsconfig alias paths and trailing commas', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.1-jsonc');
    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'types'));
    await fs.writeFile(
      path.join(snapshotDir, 'tsconfig.json'),
      '{\n' +
        '  // JSONC comments are valid in tsconfig files\n' +
        '  "compilerOptions": {\n' +
        '    "baseUrl": "src",\n' +
        '    "paths": {\n' +
        '      "@/*": ["*"],\n' +
        '    },\n' +
        '  },\n' +
        '}\n',
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Button.tsx'),
      'import type { User } from "types/model";\n' +
        'export const Button: React.FC<{ user?: User }> = () => <button />;\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'feature.tsx'),
      'import { Button } from "@/components/Button";\n' +
        'import type { User } from "@/types/model";\n' +
        'const users: User[] = [];\n' +
        'export function Feature() { return <Button user={users[0]} />; }\n',
    );

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5005,
      status: 'ready',
      rootPath: snapshotDir,
    });

    await rebuildSourceSnapshotIndex(705);

    const createPayload = sourceIndexArtifactCreateMock.mock.calls[0]?.[0];
    const parsedArtifact = JSON.parse(createPayload.data.contentJson as string) as {
      summary: {
        warnings: string[];
      };
      files: Array<{
        path: string;
        localDependencies: string[];
      }>;
    };

    expect(parsedArtifact.summary.warnings).not.toContain('Unable to parse tsconfig.json');
    expect(parsedArtifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/feature.tsx',
          localDependencies: ['src/components/Button.tsx', 'src/types/model.ts'],
        }),
      ]),
    );
  });

  test('rebuilds source index with export-from dependencies in localDependencies', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.3');
    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'types'));
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Button.tsx'),
      'export function Button() { return <button />; }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'index.ts'),
      'export { Button } from "./Button";\n',
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'index.ts'),
      'export * from "./model";\n',
    );

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5006,
      status: 'ready',
      rootPath: snapshotDir,
    });

    await rebuildSourceSnapshotIndex(706);

    const createPayload = sourceIndexArtifactCreateMock.mock.calls[0]?.[0];
    const parsedArtifact = JSON.parse(createPayload.data.contentJson as string) as {
      files: Array<{
        path: string;
        imports: string[];
        localDependencies: string[];
      }>;
    };

    expect(parsedArtifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/components/index.ts',
          imports: ['./Button'],
          localDependencies: ['src/components/Button.tsx'],
        }),
        expect.objectContaining({
          path: 'src/types/index.ts',
          imports: ['./model'],
          localDependencies: ['src/types/model.ts'],
        }),
      ]),
    );
  });

  test('records a warning when tsconfig alias configuration cannot be parsed', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.2');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'tsconfig.json'), '{"compilerOptions": ');
    await fs.writeFile(path.join(snapshotDir, 'src', 'index.ts'), 'export const ready = true;\n');

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5004,
      status: 'ready',
      rootPath: snapshotDir,
    });

    await rebuildSourceSnapshotIndex(704);

    const createPayload = sourceIndexArtifactCreateMock.mock.calls[0]?.[0];
    const parsedArtifact = JSON.parse(createPayload.data.contentJson as string) as {
      summary: {
        warnings: string[];
      };
    };

    expect(parsedArtifact.summary.warnings.some((warning) => /tsconfig\.json/i.test(warning))).toBe(true);
  });

  test('marks index status failed when rebuild fails after entering indexing', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.1.0');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'package.json'), JSON.stringify({ name: 'crm-ui' }, null, 2));
    await fs.writeFile(path.join(snapshotDir, 'src', 'index.ts'), 'export const ready = true;\n');

    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5002,
      status: 'ready',
      rootPath: snapshotDir,
    });
    sourceIndexArtifactCreateMock.mockRejectedValueOnce(new Error('artifact creation failed'));

    await expect(rebuildSourceSnapshotIndex(702)).rejects.toThrow('artifact creation failed');

    expect(sourceSnapshotUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5002 },
        data: {
          indexStatus: 'indexing',
          indexGeneratedAt: null,
          indexErrorMessage: null,
        },
      }),
    );
    expect(sourceSnapshotUpdateManyMock).toHaveBeenCalledWith({
      where: { versionId: 702 },
      data: {
        indexStatus: 'failed',
        indexGeneratedAt: null,
        indexErrorMessage: 'artifact creation failed',
      },
    });
  });

  test('backfill throttles repeated scans and retries snapshots that fail later', async () => {
    let now = 1_000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);

    try {
      const pendingSnapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v2.0.0');
      const failedSnapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v2.0.1');
      await fse.ensureDir(path.join(pendingSnapshotDir, 'src'));
      await fse.ensureDir(path.join(failedSnapshotDir, 'src'));
      await fs.writeFile(path.join(pendingSnapshotDir, 'src', 'index.ts'), 'export const pending = true;\n');
      await fs.writeFile(path.join(failedSnapshotDir, 'src', 'index.ts'), 'export const failed = true;\n');

      let backfillScanCount = 0;
      sourceSnapshotFindManyMock.mockImplementation(async () => {
        backfillScanCount += 1;
        return backfillScanCount === 1 ? [{ versionId: 801 }] : [{ versionId: 802 }];
      });
      sourceSnapshotFindUniqueMock.mockImplementation(async ({ where }: { where: { versionId: number } }) => {
        if (where.versionId === 801) {
          return {
            id: 5801,
            status: 'ready',
            rootPath: pendingSnapshotDir,
          };
        }

        if (where.versionId === 802) {
          return {
            id: 5802,
            status: 'ready',
            rootPath: failedSnapshotDir,
          };
        }
      });

      await ensureSourceIndexBackfillScheduled();
      await ensureSourceIndexBackfillScheduled();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sourceSnapshotFindManyMock).toHaveBeenCalledTimes(1);
      expect(sourceSnapshotFindManyMock).toHaveBeenCalledWith({
        where: {
          status: 'ready',
          indexStatus: {
            in: ['pending', 'failed'],
          },
          version: {
            status: 'published',
          },
        },
        select: {
          versionId: true,
        },
        orderBy: {
          versionId: 'asc',
        },
      });
      expect(sourceSnapshotFindUniqueMock).toHaveBeenCalledTimes(1);
      expect(sourceSnapshotFindUniqueMock).toHaveBeenNthCalledWith(1, {
        where: { versionId: 801 },
        select: {
          id: true,
          status: true,
          rootPath: true,
        },
      });

      await ensureSourceIndexBackfillScheduled();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(sourceSnapshotFindManyMock).toHaveBeenCalledTimes(1);

      now += 30_000;
      await ensureSourceIndexBackfillScheduled();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sourceSnapshotFindManyMock).toHaveBeenCalledTimes(2);
      expect(sourceSnapshotFindUniqueMock).toHaveBeenCalledTimes(2);
      expect(sourceSnapshotFindUniqueMock).toHaveBeenNthCalledWith(2, {
        where: { versionId: 802 },
        select: {
          id: true,
          status: true,
          rootPath: true,
        },
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  test('starts a single background backfill loop that rescans pending snapshots on an interval', async () => {
    vi.useFakeTimers();
    try {
      sourceSnapshotFindManyMock.mockResolvedValue([]);

      startSourceIndexBackfillLoop();
      startSourceIndexBackfillLoop();
      await vi.advanceTimersByTimeAsync(0);

      expect(sourceSnapshotFindManyMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(sourceSnapshotFindManyMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('skips index writes when a queued backfill snapshot is no longer ready', async () => {
    __resetSourceIndexQueueState();
    sourceSnapshotFindManyMock.mockResolvedValue([{ versionId: 901 }]);
    sourceSnapshotFindUniqueMock.mockResolvedValue({
      id: 5901,
      status: 'failed',
      rootPath: path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v3.0.0'),
    });

    await ensureSourceIndexBackfillScheduled();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sourceSnapshotFindUniqueMock).toHaveBeenCalledWith({
      where: { versionId: 901 },
      select: {
        id: true,
        status: true,
        rootPath: true,
      },
    });
    expect(sourceSnapshotUpdateMock).not.toHaveBeenCalled();
    expect(sourceIndexArtifactCreateMock).not.toHaveBeenCalled();
    expect(sourceSnapshotUpdateManyMock).not.toHaveBeenCalled();
  });

  test('removes partial snapshot and records failed metadata when snapshot creation fails', async () => {
    const sourceDir = path.join(tmpDir, 'source-fail');
    await fse.ensureDir(sourceDir);
    await fs.writeFile(path.join(sourceDir, 'README.md'), 'keep');

    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v9.9.9');
    const copyError = new Error('copy failed on purpose');
    const copySpy = vi.spyOn(fse, 'copy').mockImplementationOnce(async () => {
      await fse.ensureDir(snapshotDir);
      await fs.writeFile(path.join(snapshotDir, 'partial.txt'), 'partial');
      throw copyError;
    });

    await expect(
      createSourceSnapshot({
        userId: 'user-1',
        versionId: 2002,
        productKey: 'crm',
        version: 'v9.9.9',
        sourceDir,
      }),
    ).rejects.toThrow('copy failed on purpose');

    await expect(fse.pathExists(snapshotDir)).resolves.toBe(false);
    expect(sourceSnapshotUpsertMock).toHaveBeenCalledWith({
      where: { versionId: 2002 },
      create: {
        versionId: 2002,
        status: 'failed',
        indexStatus: 'failed',
        rootPath: snapshotDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: 'copy failed on purpose',
        indexGeneratedAt: null,
        indexErrorMessage: 'copy failed on purpose',
      },
      update: {
        status: 'failed',
        indexStatus: 'failed',
        rootPath: snapshotDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: 'copy failed on purpose',
        indexGeneratedAt: null,
        indexErrorMessage: 'copy failed on purpose',
      },
    });

    copySpy.mockRestore();
  });

  test('lists only products and versions that are published and snapshot-ready', async () => {
    productFindManyMock.mockResolvedValue([
      {
        key: 'crm',
        name: 'CRM',
        description: 'Customer manager',
        versions: [
          { version: 'v2.0.0', isDefault: false, createdAt: new Date('2024-02-01T00:00:00.000Z') },
          { version: 'v1.0.0', isDefault: true, createdAt: new Date('2024-01-01T00:00:00.000Z') },
        ],
      },
      {
        key: 'erp',
        name: 'ERP',
        description: null,
        versions: [],
      },
    ]);
    productVersionFindManyMock.mockResolvedValue([
      {
        version: 'v2.0.0',
        entryUrl: '/preview/crm/v2.0.0/index.html',
        status: 'published',
        isDefault: false,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
      {
        version: 'v1.0.0',
        entryUrl: '/preview/crm/v1.0.0/index.html',
        status: 'published',
        isDefault: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);

    const products = await listPublishedSnapshotProducts(mcpAccessScope);
    const versions = await listPublishedSnapshotVersions(mcpAccessScope, 'crm');

    expect(products).toEqual([
      {
        productKey: 'crm',
        name: 'CRM',
        description: 'Customer manager',
        publishedVersionCount: 2,
        defaultVersion: 'v1.0.0',
      },
    ]);
    expect(versions).toEqual([
      {
        version: 'v2.0.0',
        status: 'published',
        isDefault: false,
        previewEntryUrl: '/preview/crm/v2.0.0/index.html',
        createdAt: '2024-02-01T00:00:00.000Z',
      },
      {
        version: 'v1.0.0',
        status: 'published',
        isDefault: true,
        previewEntryUrl: '/preview/crm/v1.0.0/index.html',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  test('resolves published snapshot version for default/latest/exact selectors', async () => {
    const defaultRoot = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    const latestRoot = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v2.0.0');
    const exactRoot = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.5.0');
    productVersionFindFirstMock
      .mockResolvedValueOnce({
        version: 'v1.0.0',
        isDefault: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        sourceSnapshot: {
          status: 'ready',
          rootPath: defaultRoot,
        },
      })
      .mockResolvedValueOnce({
        version: 'v2.0.0',
        isDefault: false,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
        sourceSnapshot: {
          status: 'ready',
          rootPath: latestRoot,
        },
      })
      .mockResolvedValueOnce({
        version: 'v1.5.0',
        isDefault: false,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        sourceSnapshot: {
          status: 'ready',
          rootPath: exactRoot,
        },
      });

    const resolvedDefault = await resolvePublishedSnapshotVersion(mcpAccessScope, 'crm', 'default');
    const resolvedLatest = await resolvePublishedSnapshotVersion(mcpAccessScope, 'crm', 'latest');
    const resolvedExact = await resolvePublishedSnapshotVersion(mcpAccessScope, 'crm', { exact: 'v1.5.0' });

    expect(resolvedDefault).toEqual({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      rootPath: defaultRoot,
    });
    expect(resolvedLatest).toEqual({
      version: 'v2.0.0',
      isDefault: false,
      createdAt: '2024-02-01T00:00:00.000Z',
      rootPath: latestRoot,
    });
    expect(resolvedExact).toEqual({
      version: 'v1.5.0',
      isDefault: false,
      createdAt: '2024-01-15T00:00:00.000Z',
      rootPath: exactRoot,
    });
  });

  test('gets source tree rooted at slash path', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'README.md'), '# Project');
    await fs.writeFile(path.join(snapshotDir, 'src', 'index.ts'), 'export {}');
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: snapshotDir,
      },
    });

    const tree = await getSourceTree(mcpAccessScope, 'crm', 'v1.0.0', '/', 1);

    expect(tree.path).toBe('.');
    expect(tree.type).toBe('directory');
    expect(tree.tree.path).toBe('.');
    expect(tree.tree.type).toBe('directory');
    expect(tree.tree.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'README.md', type: 'file' }),
        expect.objectContaining({ path: 'src', type: 'directory' }),
      ]),
    );
  });

  test('reads a file by line range and reports truncated metadata', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'src', 'feature.ts'), 'line-1\nline-2\nline-3\nline-4\nline-5\nline-6');
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: snapshotDir,
      },
    });

    const result = await readSourceFile(mcpAccessScope, 'crm', 'v1.0.0', 'src/feature.ts', { startLine: 2, endLine: 4 });

    expect(result.path).toBe('src/feature.ts');
    expect(result.content).toBe('line-2\nline-3\nline-4');
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(4);
    expect(result.totalLines).toBe(6);
    expect(result.truncated).toBe(true);
  });

  test('rejects source file paths that escape into a sibling snapshot directory', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1');
    const siblingSnapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v10');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fse.ensureDir(path.join(siblingSnapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'src', 'safe.ts'), 'export const safe = true;\n');
    await fs.writeFile(path.join(siblingSnapshotDir, 'src', 'secret.ts'), 'export const secret = true;\n');
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: snapshotDir,
      },
    });

    await expect(readSourceFile(mcpAccessScope, 'crm', 'v1', '../v10/src/secret.ts')).rejects.toThrow(
      'Resolved child path escapes root directory',
    );
  });

  test('reads requested lines beyond the previous prefix limit for large text files', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    const lineCount = 50000;
    const lines = Array.from({ length: lineCount }, (_, index) => `line-${index + 1}`);
    await fs.writeFile(path.join(snapshotDir, 'src', 'large-feature.ts'), lines.join('\n'));
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: snapshotDir,
      },
    });

    const result = await readSourceFile(mcpAccessScope, 'crm', 'v1.0.0', 'src/large-feature.ts', { startLine: 35000, endLine: 35002 });

    expect(result.path).toBe('src/large-feature.ts');
    expect(result.content).toBe('line-35000\nline-35001\nline-35002');
    expect(result.startLine).toBe(35000);
    expect(result.endLine).toBe(35002);
    expect(result.totalLines).toBe(lineCount);
    expect(result.truncated).toBe(true);
  });

  test('searches only text files below the hard size limit', async () => {
    const snapshotDir = path.join(testState.sourceSnapshotsDir, 'user-1', 'crm', 'v1.0.0');
    await fse.ensureDir(path.join(snapshotDir, 'src'));
    await fs.writeFile(path.join(snapshotDir, 'src', 'match.ts'), 'const token = "alpha-needle";\n');
    await fs.writeFile(path.join(snapshotDir, 'src', 'skip.bin'), Buffer.from([0, 159, 146, 150, 0, 255]));
    await fs.writeFile(path.join(snapshotDir, 'src', 'too-large.txt'), `${'x'.repeat(2 * 1024 * 1024)} alpha-needle`);
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: snapshotDir,
      },
    });

    const result = await searchSourceFiles(mcpAccessScope, 'crm', 'v1.0.0', 'alpha-needle');

    expect(result.query).toBe('alpha-needle');
    expect(result.results).toEqual([
      {
        path: 'src/match.ts',
        matchCount: 1,
      },
    ]);
  });

  test('rejects published snapshot records with out-of-root rootPath', async () => {
    const outsideRootPath = path.resolve(testState.sourceSnapshotsDir, '..', '..', 'outside-snapshots', 'crm', 'v1.0.0');
    productVersionFindFirstMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      sourceSnapshot: {
        status: 'ready',
        rootPath: outsideRootPath,
      },
    });

    await expect(readSourceFile(mcpAccessScope, 'crm', 'v1.0.0', 'src/index.ts')).rejects.toThrow('Published source snapshot not found');
  });

  test('scopes product and version queries to the authenticated mcp key user and allowed products', async () => {
    productFindManyMock.mockResolvedValue([]);
    productVersionFindManyMock.mockResolvedValue([]);
    productVersionFindFirstMock.mockResolvedValue(null);

    await listPublishedSnapshotProducts(mcpAccessScope);
    await listPublishedSnapshotVersions(mcpAccessScope, 'crm');
    await expect(resolvePublishedSnapshotVersion(mcpAccessScope, 'crm', 'default')).rejects.toThrow(
      'Published source snapshot not found',
    );

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [11] },
          ownerId: 'user-1',
        }),
      }),
    );

    expect(productVersionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: {
            key: 'crm',
            ownerId: 'user-1',
            id: { in: [11] },
          },
        }),
      }),
    );

    expect(productVersionFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: {
            key: 'crm',
            ownerId: 'user-1',
            id: { in: [11] },
          },
        }),
      }),
    );
  });
});
