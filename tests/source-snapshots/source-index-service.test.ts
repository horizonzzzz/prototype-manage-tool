import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { productVersionFindFirstMock } = vi.hoisted(() => ({
  productVersionFindFirstMock: vi.fn(),
}));

const resolvePublishedSnapshotVersionMock = vi.hoisted(() => vi.fn());
const ensureSourceIndexBackfillScheduledMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVersion: {
      findFirst: productVersionFindFirstMock,
    },
  },
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  resolvePublishedSnapshotVersion: resolvePublishedSnapshotVersionMock,
}));

vi.mock('@/lib/server/source-index-queue', () => ({
  ensureSourceIndexBackfillScheduled: ensureSourceIndexBackfillScheduledMock,
}));

import {
  getSourceIndexStatus,
  queryCodebaseSummary,
  queryComponentContext,
  queryTypeDefinition,
  searchSourceWithContext,
} from '@/lib/server/source-index-service';

const scope = {
  userId: 'user-1',
  apiKeyId: 7,
  allowedProductIds: [11],
};

describe('source index service', () => {
  let tmpDir: string;
  let snapshotDir: string;
  let artifact: {
    format: string;
    snapshotVersionId: number;
    generatedAt: string;
    summary: {
      fileCount: number;
      totalBytes: number;
      frameworkHints: string[];
      routingMode: string;
      warnings: string[];
    };
    files: Array<{
      path: string;
      size: number;
      ext: string;
      imports: string[];
      exports: string[];
      localDependencies: string[];
      symbols: {
        components: Array<{ name: string; line: number }>;
        types: Array<{ name: string; kind: 'interface' | 'type' | 'enum'; line: number }>;
      };
    }>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ensureSourceIndexBackfillScheduledMock.mockResolvedValue(undefined);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-service-'));
    snapshotDir = path.join(tmpDir, 'snapshot');
    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'types'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'mocks'));
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Button.tsx'),
      'export function Button() { return <button /> }\n',
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(path.join(snapshotDir, 'src', 'mocks', 'users.ts'), 'export const mockUsers = [{ id: "u-1" }];\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'feature.tsx'),
      'import { Button } from "./components/Button";\n' +
        'import type { User } from "./types/model";\n' +
        'const users: User[] = [];\n' +
        'export function Feature() { return <Button /> }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'feature-search.tsx'),
      'const state = "needle-here";\nconst other = "needle-here";\n',
    );

    resolvePublishedSnapshotVersionMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      rootPath: snapshotDir,
    });

    artifact = {
      format: 'source-tree-v1',
      snapshotVersionId: 101,
      generatedAt: '2024-01-01T00:00:00.000Z',
      summary: {
        fileCount: 5,
        totalBytes: 400,
        frameworkHints: ['react', 'vite'],
        routingMode: 'app-tsx-state',
        warnings: ['No dedicated router detected'],
      },
      files: [
        {
          path: 'src/components/Button.tsx',
          size: 46,
          ext: '.tsx',
          imports: [],
          exports: ['Button'],
          localDependencies: [],
          symbols: {
            components: [{ name: 'Button', line: 1 }],
            types: [],
          },
        },
        {
          path: 'src/types/model.ts',
          size: 37,
          ext: '.ts',
          imports: [],
          exports: ['User'],
          localDependencies: [],
          symbols: {
            components: [],
            types: [{ name: 'User', kind: 'interface', line: 1 }],
          },
        },
        {
          path: 'src/mocks/users.ts',
          size: 41,
          ext: '.ts',
          imports: [],
          exports: ['mockUsers'],
          localDependencies: [],
          symbols: {
            components: [],
            types: [],
          },
        },
        {
          path: 'src/feature.tsx',
          size: 150,
          ext: '.tsx',
          imports: ['./components/Button', './types/model'],
          exports: ['Feature'],
          localDependencies: ['src/components/Button.tsx', 'src/types/model.ts'],
          symbols: {
            components: [{ name: 'Feature', line: 4 }],
            types: [],
          },
        },
        {
          path: 'src/feature-search.tsx',
          size: 60,
          ext: '.tsx',
          imports: [],
          exports: [],
          localDependencies: [],
          symbols: {
            components: [],
            types: [],
          },
        },
      ],
    };

    productVersionFindFirstMock.mockResolvedValue({
      id: 101,
      version: 'v1.0.0',
      product: { key: 'crm', ownerId: 'user-1', id: 11 },
      sourceSnapshot: {
        id: 801,
        status: 'ready',
        indexStatus: 'ready',
        indexGeneratedAt: new Date('2024-01-01T00:00:00.000Z'),
        indexErrorMessage: null,
        indexArtifacts: [
          {
            id: 901,
            artifactKey: 'source-tree-v1',
            status: 'ready',
            generatedAt: new Date('2024-01-01T00:00:00.000Z'),
            errorMessage: null,
            contentJson: JSON.stringify(artifact),
          },
        ],
      },
    });
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  test('returns codebase summary from the persisted artifact', async () => {
    const result = await queryCodebaseSummary(scope, { productKey: 'crm', selector: 'latest' });

    expect(result.status).toBe('ready');
    expect(result.warnings).toEqual(['No dedicated router detected']);
    expect(result.payload).toMatchObject({
      framework: 'react',
      techStack: ['react', 'vite'],
      routing: {
        mode: 'app-tsx-state',
      },
      counts: {
        files: 5,
        totalBytes: 400,
      },
      keyFiles: expect.arrayContaining(['src/components/Button.tsx', 'src/feature.tsx']),
      warnings: ['No dedicated router detected'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'latest');
  });

  test('returns component context with imports, usedBy, and relatedFiles', async () => {
    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'Button',
      file: 'src/components/Button.tsx',
      definitionCandidates: [{ file: 'src/components/Button.tsx', line: 1 }],
      dependencies: [],
      usedBy: ['src/feature.tsx'],
      relatedFiles: ['src/feature.tsx'],
      imports: [],
      exports: ['Button'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', { exact: 'v1.0.0' });
  });

  test('returns type definition context including usage files', async () => {
    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      selector: 'default',
      typeName: 'User',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      typeName: 'User',
      definitionCandidates: [{ file: 'src/types/model.ts', line: 1, kind: 'interface' }],
      usedIn: ['src/feature.tsx'],
      relatedFiles: ['src/feature.tsx'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'default');
  });

  test('returns search results with line context from snapshot files', async () => {
    const result = await searchSourceWithContext(scope, {
      productKey: 'crm',
      selector: 'default',
      query: 'needle-here',
      contextLines: 1,
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.query).toBe('needle-here');
    expect(result.payload?.results).toEqual([
      {
        path: 'src/feature-search.tsx',
        matches: [
          {
            line: 1,
            content: 'const state = "needle-here";',
            contextBefore: [],
            contextAfter: ['const other = "needle-here";'],
          },
          {
            line: 2,
            content: 'const other = "needle-here";',
            contextBefore: ['const state = "needle-here";'],
            contextAfter: [''],
          },
        ],
      },
    ]);
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'default');
  });

  test('skips binary and oversized files when collecting contextual search results', async () => {
    await fs.writeFile(path.join(snapshotDir, 'src', 'binary.bin'), Buffer.from('needle-here\0binary\0content', 'utf8'));
    await fs.writeFile(path.join(snapshotDir, 'src', 'too-large.txt'), `${'x'.repeat(200 * 1024)} needle-here`);

    artifact.files.push(
      {
        path: 'src/binary.bin',
        size: 25,
        ext: '.bin',
        imports: [],
        exports: [],
        localDependencies: [],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/too-large.txt',
        size: 200 * 1024 + 12,
        ext: '.txt',
        imports: [],
        exports: [],
        localDependencies: [],
        symbols: {
          components: [],
          types: [],
        },
      },
    );

    productVersionFindFirstMock.mockResolvedValue({
      id: 101,
      version: 'v1.0.0',
      product: { key: 'crm', ownerId: 'user-1', id: 11 },
      sourceSnapshot: {
        id: 801,
        status: 'ready',
        indexStatus: 'ready',
        indexGeneratedAt: new Date('2024-01-01T00:00:00.000Z'),
        indexErrorMessage: null,
        indexArtifacts: [
          {
            id: 901,
            artifactKey: 'source-tree-v1',
            status: 'ready',
            generatedAt: new Date('2024-01-01T00:00:00.000Z'),
            errorMessage: null,
            contentJson: JSON.stringify(artifact),
          },
        ],
      },
    });

    const result = await searchSourceWithContext(scope, {
      productKey: 'crm',
      selector: 'default',
      query: 'needle-here',
      contextLines: 1,
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.results).toEqual([
      {
        path: 'src/feature-search.tsx',
        matches: [
          {
            line: 1,
            content: 'const state = "needle-here";',
            contextBefore: [],
            contextAfter: ['const other = "needle-here";'],
          },
          {
            line: 2,
            content: 'const other = "needle-here";',
            contextBefore: ['const state = "needle-here";'],
            contextAfter: [''],
          },
        ],
      },
    ]);
  });

  test('returns structured non-ready status when index is pending', async () => {
    productVersionFindFirstMock.mockResolvedValue({
      sourceSnapshot: {
        id: 801,
        status: 'ready',
        indexStatus: 'pending',
        indexGeneratedAt: null,
        indexErrorMessage: null,
        indexArtifacts: [],
      },
    });

    const statusResult = await getSourceIndexStatus(scope, { productKey: 'crm', selector: 'latest' });
    const summaryResult = await queryCodebaseSummary(scope, { productKey: 'crm', selector: 'latest' });

    expect(statusResult).toEqual({
      status: 'pending',
      warnings: [],
      payload: {
        generatedAt: null,
        errorMessage: null,
      },
    });
    expect(summaryResult).toEqual({
      status: 'pending',
      warnings: [],
      payload: null,
    });
    expect(ensureSourceIndexBackfillScheduledMock).toHaveBeenCalledTimes(2);
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'latest');
  });

  test('triggers lazy source-index backfill for failed indexes without changing response contract', async () => {
    productVersionFindFirstMock.mockResolvedValue({
      sourceSnapshot: {
        id: 802,
        status: 'ready',
        indexStatus: 'failed',
        indexGeneratedAt: null,
        indexErrorMessage: 'artifact creation failed',
        indexArtifacts: [],
      },
    });

    const statusResult = await getSourceIndexStatus(scope, { productKey: 'crm', selector: 'latest' });

    expect(statusResult).toEqual({
      status: 'failed',
      warnings: ['artifact creation failed'],
      payload: {
        generatedAt: null,
        errorMessage: 'artifact creation failed',
      },
    });
    expect(ensureSourceIndexBackfillScheduledMock).toHaveBeenCalledTimes(1);
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'latest');
  });
});
