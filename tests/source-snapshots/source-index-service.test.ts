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
      importEntries: Array<{
        source: string;
        resolvedPath: string | null;
        kind: 'named' | 'default' | 'namespace' | 'side-effect' | 'dynamic' | 'require';
        importedName: string | null;
        localName: string | null;
        isTypeOnly: boolean;
      }>;
      reExportEntries: Array<{
        source: string;
        resolvedPath: string | null;
        kind: 'named' | 'all' | 'namespace';
        importedName: string | null;
        exportedName: string | null;
        isTypeOnly: boolean;
      }>;
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
          importEntries: [],
          reExportEntries: [],
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
          importEntries: [],
          reExportEntries: [],
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
          importEntries: [],
          reExportEntries: [],
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
          importEntries: [
            {
              source: './components/Button',
              resolvedPath: 'src/components/Button.tsx',
              kind: 'named',
              importedName: 'Button',
              localName: 'Button',
              isTypeOnly: false,
            },
            {
              source: './types/model',
              resolvedPath: 'src/types/model.ts',
              kind: 'named',
              importedName: 'User',
              localName: 'User',
              isTypeOnly: true,
            },
          ],
          reExportEntries: [],
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
          importEntries: [],
          reExportEntries: [],
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

  test('filters component usage to symbol-level imports instead of every importer of the file', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'multi.tsx'),
      'export function SpecialButton() { return <button /> }\n' +
        'export function Dialog() { return <dialog /> }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'dialog-consumer.tsx'),
      'import { Dialog } from "./components/multi";\n' +
        'export function DialogConsumer() { return <Dialog /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/multi.tsx',
        size: 96,
        ext: '.tsx',
        imports: [],
        exports: ['SpecialButton', 'Dialog'],
        localDependencies: [],
        importEntries: [],
        reExportEntries: [],
        symbols: {
          components: [
            { name: 'SpecialButton', line: 1 },
            { name: 'Dialog', line: 2 },
          ],
          types: [],
        },
      },
      {
        path: 'src/dialog-consumer.tsx',
        size: 95,
        ext: '.tsx',
        imports: ['./components/multi'],
        exports: ['DialogConsumer'],
        localDependencies: ['src/components/multi.tsx'],
        importEntries: [
          {
            source: './components/multi',
            resolvedPath: 'src/components/multi.tsx',
            kind: 'named',
            importedName: 'Dialog',
            localName: 'Dialog',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'DialogConsumer', line: 2 }],
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

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'SpecialButton',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'SpecialButton',
      file: 'src/components/multi.tsx',
      definitionCandidates: [{ file: 'src/components/multi.tsx', line: 1 }],
      dependencies: [],
      usedBy: [],
      relatedFiles: [],
      imports: [],
      exports: ['Dialog', 'SpecialButton'],
    });
  });

  test('preserves usage lookups for legacy ready artifacts without structured import entries', async () => {
    const legacyArtifact = JSON.parse(JSON.stringify(artifact)) as typeof artifact;

    for (const file of legacyArtifact.files) {
      delete (file as { importEntries?: unknown }).importEntries;
      delete (file as { reExportEntries?: unknown }).reExportEntries;
    }

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
            contentJson: JSON.stringify(legacyArtifact),
          },
        ],
      },
    });

    const componentResult = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(componentResult.status).toBe('ready');
    expect(componentResult.payload?.usedBy).toEqual(['src/feature.tsx']);

    const typeResult = await queryTypeDefinition(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      typeName: 'User',
    });

    expect(typeResult.status).toBe('ready');
    expect(typeResult.payload?.usedIn).toEqual(['src/feature.tsx']);
  });

  test('counts default imports when computing component usage', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'DefaultButton.tsx'),
      'export default function DefaultButton() { return <button /> }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'default-consumer.tsx'),
      'import DefaultButton from "./components/DefaultButton";\n' +
        'export function DefaultConsumer() { return <DefaultButton /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/DefaultButton.tsx',
        size: 61,
        ext: '.tsx',
        imports: [],
        exports: ['DefaultButton'],
        localDependencies: [],
        importEntries: [],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'DefaultButton', line: 1 }],
          types: [],
        },
      },
      {
        path: 'src/default-consumer.tsx',
        size: 115,
        ext: '.tsx',
        imports: ['./components/DefaultButton'],
        exports: ['DefaultConsumer'],
        localDependencies: ['src/components/DefaultButton.tsx'],
        importEntries: [
          {
            source: './components/DefaultButton',
            resolvedPath: 'src/components/DefaultButton.tsx',
            kind: 'default',
            importedName: 'default',
            localName: 'DefaultButton',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'DefaultConsumer', line: 2 }],
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

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'DefaultButton',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual(['src/default-consumer.tsx']);
  });

  test('counts namespace imports when computing component usage', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'index.ts'),
      'export { Button } from "./Button";\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'namespace-consumer.tsx'),
      'import * as ui from "./components";\n' + 'export function NamespaceConsumer() { return <ui.Button /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/index.ts',
        size: 35,
        ext: '.ts',
        imports: ['./Button'],
        exports: ['Button'],
        localDependencies: ['src/components/Button.tsx'],
        importEntries: [],
        reExportEntries: [
          {
            source: './Button',
            resolvedPath: 'src/components/Button.tsx',
            kind: 'named',
            importedName: 'Button',
            exportedName: 'Button',
            isTypeOnly: false,
          },
        ],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/namespace-consumer.tsx',
        size: 95,
        ext: '.tsx',
        imports: ['./components'],
        exports: ['NamespaceConsumer'],
        localDependencies: ['src/components/index.ts'],
        importEntries: [
          {
            source: './components',
            resolvedPath: 'src/components/index.ts',
            kind: 'namespace',
            importedName: null,
            localName: 'ui',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'NamespaceConsumer', line: 2 }],
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

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toContain('src/namespace-consumer.tsx');
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

  test('counts namespace imports when computing type usage', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'index.ts'),
      'export { User } from "./model";\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'namespace-type-consumer.ts'),
      'import * as models from "./types";\n' + 'const currentUser: models.User | null = null;\n',
    );

    artifact.files.push(
      {
        path: 'src/types/index.ts',
        size: 30,
        ext: '.ts',
        imports: ['./model'],
        exports: ['User'],
        localDependencies: ['src/types/model.ts'],
        importEntries: [],
        reExportEntries: [
          {
            source: './model',
            resolvedPath: 'src/types/model.ts',
            kind: 'named',
            importedName: 'User',
            exportedName: 'User',
            isTypeOnly: true,
          },
        ],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/namespace-type-consumer.ts',
        size: 79,
        ext: '.ts',
        imports: ['./types'],
        exports: [],
        localDependencies: ['src/types/index.ts'],
        importEntries: [
          {
            source: './types',
            resolvedPath: 'src/types/index.ts',
            kind: 'namespace',
            importedName: null,
            localName: 'models',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
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

    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      typeName: 'User',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedIn).toContain('src/namespace-type-consumer.ts');
  });

  test('follows named re-export barrels for component usedBy results', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'index.ts'),
      'export { Button } from "./Button";\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'barrel-consumer.tsx'),
      'import { Button } from "./components";\n' +
        'export function BarrelConsumer() { return <Button /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/index.ts',
        size: 35,
        ext: '.ts',
        imports: ['./Button'],
        exports: ['Button'],
        localDependencies: ['src/components/Button.tsx'],
        importEntries: [],
        reExportEntries: [
          {
            source: './Button',
            resolvedPath: 'src/components/Button.tsx',
            kind: 'named',
            importedName: 'Button',
            exportedName: 'Button',
            isTypeOnly: false,
          },
        ],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/barrel-consumer.tsx',
        size: 98,
        ext: '.tsx',
        imports: ['./components'],
        exports: ['BarrelConsumer'],
        localDependencies: ['src/components/index.ts'],
        importEntries: [
          {
            source: './components',
            resolvedPath: 'src/components/index.ts',
            kind: 'named',
            importedName: 'Button',
            localName: 'Button',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'BarrelConsumer', line: 2 }],
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
      usedBy: ['src/barrel-consumer.tsx', 'src/components/index.ts', 'src/feature.tsx'],
      relatedFiles: ['src/barrel-consumer.tsx', 'src/components/index.ts', 'src/feature.tsx'],
      imports: [],
      exports: ['Button'],
    });
  });

  test('follows import-then-export barrels for component usedBy results', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'bridge.ts'),
      'import { Button } from "./Button";\n' + 'export { Button };\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'bridge-consumer.tsx'),
      'import { Button } from "./components/bridge";\n' +
        'export function BridgeConsumer() { return <Button /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/bridge.ts',
        size: 54,
        ext: '.ts',
        imports: ['./Button'],
        exports: ['Button'],
        localDependencies: ['src/components/Button.tsx'],
        importEntries: [
          {
            source: './Button',
            resolvedPath: 'src/components/Button.tsx',
            kind: 'named',
            importedName: 'Button',
            localName: 'Button',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/bridge-consumer.tsx',
        size: 100,
        ext: '.tsx',
        imports: ['./components/bridge'],
        exports: ['BridgeConsumer'],
        localDependencies: ['src/components/bridge.ts'],
        importEntries: [
          {
            source: './components/bridge',
            resolvedPath: 'src/components/bridge.ts',
            kind: 'named',
            importedName: 'Button',
            localName: 'Button',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'BridgeConsumer', line: 2 }],
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

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual(['src/bridge-consumer.tsx', 'src/components/bridge.ts', 'src/feature.tsx']);
  });

  test('follows aliased import-then-export barrels for component usedBy results', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'aliased-bridge.ts'),
      'import { Button as BaseButton } from "./Button";\n' + 'export { BaseButton as Button };\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'aliased-bridge-consumer.tsx'),
      'import { Button } from "./components/aliased-bridge";\n' +
        'export function AliasedBridgeConsumer() { return <Button /> }\n',
    );

    artifact.files.push(
      {
        path: 'src/components/aliased-bridge.ts',
        size: 84,
        ext: '.ts',
        imports: ['./Button'],
        exports: ['Button'],
        localDependencies: ['src/components/Button.tsx'],
        importEntries: [
          {
            source: './Button',
            resolvedPath: 'src/components/Button.tsx',
            kind: 'named',
            importedName: 'Button',
            localName: 'BaseButton',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/aliased-bridge-consumer.tsx',
        size: 116,
        ext: '.tsx',
        imports: ['./components/aliased-bridge'],
        exports: ['AliasedBridgeConsumer'],
        localDependencies: ['src/components/aliased-bridge.ts'],
        importEntries: [
          {
            source: './components/aliased-bridge',
            resolvedPath: 'src/components/aliased-bridge.ts',
            kind: 'named',
            importedName: 'Button',
            localName: 'Button',
            isTypeOnly: false,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [{ name: 'AliasedBridgeConsumer', line: 2 }],
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

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toContain('src/components/aliased-bridge.ts');
    expect(result.payload?.usedBy).toContain('src/aliased-bridge-consumer.tsx');
  });

  test('follows export-star barrels and excludes consumers of other types from usedIn', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'combined.ts'),
      'export interface User { id: string }\n' + 'export interface Order { id: string }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'index.ts'),
      'export * from "./combined";\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'type-barrel-consumer.ts'),
      'import type { Order } from "./types";\n' + 'const currentOrder: Order | null = null;\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'order-consumer.ts'),
      'import type { User } from "./types/combined";\n' + 'const users: User[] = [];\n',
    );

    artifact.files.push(
      {
        path: 'src/types/combined.ts',
        size: 71,
        ext: '.ts',
        imports: [],
        exports: ['User', 'Order'],
        localDependencies: [],
        importEntries: [],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [
            { name: 'User', kind: 'interface', line: 1 },
            { name: 'Order', kind: 'interface', line: 2 },
          ],
        },
      },
      {
        path: 'src/types/index.ts',
        size: 28,
        ext: '.ts',
        imports: ['./combined'],
        exports: [],
        localDependencies: ['src/types/combined.ts'],
        importEntries: [],
        reExportEntries: [
          {
            source: './combined',
            resolvedPath: 'src/types/combined.ts',
            kind: 'all',
            importedName: null,
            exportedName: null,
            isTypeOnly: false,
          },
        ],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/type-barrel-consumer.ts',
        size: 77,
        ext: '.ts',
        imports: ['./types'],
        exports: [],
        localDependencies: ['src/types/index.ts'],
        importEntries: [
          {
            source: './types',
            resolvedPath: 'src/types/index.ts',
            kind: 'named',
            importedName: 'Order',
            localName: 'Order',
            isTypeOnly: true,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/order-consumer.ts',
        size: 76,
        ext: '.ts',
        imports: ['./types/combined'],
        exports: [],
        localDependencies: ['src/types/combined.ts'],
        importEntries: [
          {
            source: './types/combined',
            resolvedPath: 'src/types/combined.ts',
            kind: 'named',
            importedName: 'User',
            localName: 'User',
            isTypeOnly: true,
          },
        ],
        reExportEntries: [],
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

    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      typeName: 'Order',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      typeName: 'Order',
      definitionCandidates: [{ file: 'src/types/combined.ts', line: 2, kind: 'interface' }],
      usedIn: ['src/type-barrel-consumer.ts', 'src/types/index.ts'],
      relatedFiles: ['src/type-barrel-consumer.ts', 'src/types/index.ts'],
    });
  });

  test('follows aliased import-then-export barrels for type usedIn results', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'alias-bridge.ts'),
      'import type { User as BaseUser } from "./model";\n' + 'export type { BaseUser as User };\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'aliased-type-consumer.ts'),
      'import type { User } from "./types/alias-bridge";\n' + 'const users: User[] = [];\n',
    );

    artifact.files.push(
      {
        path: 'src/types/alias-bridge.ts',
        size: 87,
        ext: '.ts',
        imports: ['./model'],
        exports: ['User'],
        localDependencies: ['src/types/model.ts'],
        importEntries: [
          {
            source: './model',
            resolvedPath: 'src/types/model.ts',
            kind: 'named',
            importedName: 'User',
            localName: 'BaseUser',
            isTypeOnly: true,
          },
        ],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [],
        },
      },
      {
        path: 'src/aliased-type-consumer.ts',
        size: 76,
        ext: '.ts',
        imports: ['./types/alias-bridge'],
        exports: [],
        localDependencies: ['src/types/alias-bridge.ts'],
        importEntries: [
          {
            source: './types/alias-bridge',
            resolvedPath: 'src/types/alias-bridge.ts',
            kind: 'named',
            importedName: 'User',
            localName: 'User',
            isTypeOnly: true,
          },
        ],
        reExportEntries: [],
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

    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      typeName: 'User',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedIn).toContain('src/types/alias-bridge.ts');
    expect(result.payload?.usedIn).toContain('src/aliased-type-consumer.ts');
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
        importEntries: [],
        reExportEntries: [],
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
        importEntries: [],
        reExportEntries: [],
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
