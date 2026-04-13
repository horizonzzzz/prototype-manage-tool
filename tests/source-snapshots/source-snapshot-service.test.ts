import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { sourceSnapshotUpsertMock, productFindManyMock, productVersionFindManyMock, productVersionFindFirstMock } = vi.hoisted(() => ({
  sourceSnapshotUpsertMock: vi.fn(),
  productFindManyMock: vi.fn(),
  productVersionFindManyMock: vi.fn(),
  productVersionFindFirstMock: vi.fn(),
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
      upsert: sourceSnapshotUpsertMock,
    },
  },
}));

import {
  createSourceSnapshot,
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

describe('source snapshot service', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    sourceSnapshotUpsertMock.mockResolvedValue({});
    productFindManyMock.mockResolvedValue([]);
    productVersionFindManyMock.mockResolvedValue([]);
    productVersionFindFirstMock.mockResolvedValue(null);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-snapshot-service-'));
    testState.sourceSnapshotsDir = path.join(tmpDir, 'source-snapshots');
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
        rootPath: snapshotDir,
        fileCount: 2,
        totalBytes: 8,
        generatedAt: expect.any(Date),
        errorMessage: null,
      },
      update: {
        status: 'ready',
        rootPath: snapshotDir,
        fileCount: 2,
        totalBytes: 8,
        generatedAt: expect.any(Date),
        errorMessage: null,
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
        rootPath: snapshotDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: 'copy failed on purpose',
      },
      update: {
        status: 'failed',
        rootPath: snapshotDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: 'copy failed on purpose',
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
