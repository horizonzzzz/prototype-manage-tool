import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fse from 'fs-extra';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { productVersionFindFirstMock } = vi.hoisted(() => ({
  productVersionFindFirstMock: vi.fn(),
}));

const resolvePublishedSnapshotVersionMock = vi.hoisted(() => vi.fn());
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

import {
  getSourceIndexStatus,
  queryCodebaseSummary,
  queryComponentContext,
  queryTypeDefinition,
  searchSourceWithContext,
} from '@/lib/server/source-index-service';
import { buildSourceIndexArtifact } from '@/lib/server/source-index-builder';
import type { SourceIndexArtifact } from '@/lib/server/source-index-types';

const scope = {
  userId: 'user-1',
  apiKeyId: 7,
  allowedProductIds: [11],
};

const SOURCE_INDEX_INTEGRATION_TIMEOUT_MS = 30_000;

function mockReadySnapshot(artifact: SourceIndexArtifact | Record<string, unknown>) {
  productVersionFindFirstMock.mockResolvedValue({
    sourceSnapshot: {
      id: 801,
      status: 'ready',
      indexStatus: 'ready',
      indexGeneratedAt: new Date('2024-01-01T00:00:00.000Z'),
      indexErrorMessage: null,
      indexArtifacts: [
        {
          id: 901,
          artifactKey: 'source-tree-v2',
          status: 'ready',
          generatedAt: new Date('2024-01-01T00:00:00.000Z'),
          errorMessage: null,
          contentJson: JSON.stringify(artifact),
        },
      ],
    },
  });
}

describe('source index service', { timeout: SOURCE_INDEX_INTEGRATION_TIMEOUT_MS }, () => {
  let tmpDir: string;
  let snapshotDir: string;

  async function createSemanticArtifact() {
    return buildSourceIndexArtifact(snapshotDir, 101);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-service-'));
    snapshotDir = path.join(tmpDir, 'snapshot');

    await fse.ensureDir(path.join(snapshotDir, 'src', 'components'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'types'));
    await fse.ensureDir(path.join(snapshotDir, 'src', 'screens'));

    await fs.writeFile(path.join(snapshotDir, 'package.json'), '{"name":"semantic-fixture","dependencies":{"react":"19.0.0"}}\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Button.tsx'),
      'import type { ButtonProps } from "../types/button-types";\n' +
        '\n' +
        'export function Button(props: ButtonProps) {\n' +
        '  return <button>{props.label}</button>;\n' +
        '}\n',
    );
    await fs.writeFile(path.join(snapshotDir, 'src', 'components', 'index.ts'), 'export { Button } from "./Button";\n');
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'types', 'button-types.ts'),
      'export interface ButtonProps { label: string }\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'Home.tsx'),
      'import { Button } from "../components";\n' +
        'import type { ButtonProps } from "../types/button-types";\n' +
        '\n' +
        'const props: ButtonProps = { label: "Launch" };\n' +
        '\n' +
        'export function HomePage() {\n' +
        '  return <Button {...props} />;\n' +
        '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'Search.tsx'),
      'const state = "needle-here";\n' +
        'export function SearchPage() {\n' +
        '  return <div>needle-here</div>;\n' +
        '}\n',
    );

    resolvePublishedSnapshotVersionMock.mockResolvedValue({
      version: 'v1.0.0',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      rootPath: snapshotDir,
    });
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  test('returns codebase summary from semantic definitions instead of file heuristics', async () => {
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryCodebaseSummary(scope, { productKey: 'crm', selector: 'latest' });

    expect(result.status).toBe('ready');
    expect(result.warnings).toEqual(['Routing mode is unknown']);
    expect(result.payload).toEqual({
      framework: 'react',
      techStack: ['react'],
      routing: {
        mode: 'unknown',
      },
      counts: {
        files: 6,
        totalBytes: 597,
      },
      keyFiles: [
        'package.json',
        'src/components/Button.tsx',
        'src/components/index.ts',
        'src/screens/Home.tsx',
        'src/screens/Search.tsx',
        'src/types/button-types.ts',
      ],
      warnings: ['Routing mode is unknown'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'latest');
  });

  test('returns component context from semantic definitions and usages', async () => {
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'Button',
      file: 'src/components/Button.tsx',
      definitionCandidates: [
        { file: 'src/components/Button.tsx', line: 3 },
        { file: 'src/components/index.ts', line: 1 },
      ],
      dependencies: ['src/types/button-types.ts'],
      usedBy: ['src/screens/Home.tsx'],
      relatedFiles: ['src/screens/Home.tsx', 'src/types/button-types.ts'],
      imports: ['ButtonProps'],
      exports: ['Button'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', { exact: 'v1.0.0' });
  });

  test('accepts a semantically complete artifact with finalized file entries', async () => {
    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.file).toBe('src/components/Button.tsx');
    expect(result.payload?.usedBy).toEqual(['src/screens/Home.tsx']);
    expect(artifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/screens/Home.tsx',
          ext: '.tsx',
          imports: ['../components', '../types/button-types'],
          localDependencies: ['src/components/index.ts', 'src/types/button-types.ts'],
        }),
      ]),
    );
    expect(artifact.definitions.every((definition) => !('definitionId' in definition))).toBe(true);
    expect(artifact.usages.every((usage) => !('fromFilePath' in usage) && !('toFilePath' in usage))).toBe(true);
  });

  test('returns type definition context from semantic usages', async () => {
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      selector: 'default',
      typeName: 'ButtonProps',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      typeName: 'ButtonProps',
      definitionCandidates: [{ file: 'src/types/button-types.ts', line: 1, kind: 'interface' }],
      usedIn: ['src/components/Button.tsx', 'src/screens/Home.tsx'],
      relatedFiles: ['src/components/Button.tsx', 'src/screens/Home.tsx'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'default');
  });

  test('includes namespace barrel consumers in component context', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'shared.tsx'),
      'export function SharedWidget() {\n' + '  return <div />;\n' + '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'namespace-barrel.ts'),
      'export * as shared from "./shared";\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'NamespaceConsumer.tsx'),
      'import { shared } from "../components/namespace-barrel";\n' +
        '\n' +
        'export function NamespaceConsumer() {\n' +
        '  return <shared.SharedWidget />;\n' +
        '}\n',
    );
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      selector: 'default',
      componentName: 'SharedWidget',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'SharedWidget',
      file: 'src/components/shared.tsx',
      definitionCandidates: [{ file: 'src/components/shared.tsx', line: 1 }],
      dependencies: [],
      usedBy: ['src/screens/NamespaceConsumer.tsx'],
      relatedFiles: ['src/screens/NamespaceConsumer.tsx'],
      imports: [],
      exports: ['SharedWidget'],
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'default');
  });

  test('ignores usage records without a semantic definitionId match', async () => {
    const artifact = await createSemanticArtifact();
    const usages = artifact.usages;
    artifact.usages = usages.map((usage) =>
      usage.file === 'src/screens/Home.tsx' && usage.kind === 'jsx'
        ? {
            ...usage,
            definitionId: null,
          }
        : usage,
    );
    mockReadySnapshot(artifact);

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'Button',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual([]);
    expect(result.payload?.relatedFiles).toEqual(['src/types/button-types.ts']);
  });

  test('returns context for a non-exported local component without reporting it as exported', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'LocalCard.tsx'),
      'type LocalCardProps = { label: string };\n' +
        '\n' +
        'function LocalCard(props: LocalCardProps) {\n' +
        '  return <section>{props.label}</section>;\n' +
        '}\n' +
        '\n' +
        'export function LocalCardHost() {\n' +
        '  return <LocalCard label="Hi" />;\n' +
        '}\n',
    );
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'LocalCard',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'LocalCard',
      file: 'src/components/LocalCard.tsx',
      definitionCandidates: [{ file: 'src/components/LocalCard.tsx', line: 3 }],
      dependencies: [],
      usedBy: [],
      relatedFiles: [],
      imports: [],
      exports: [],
    });
  });

  test('does not report same-file props definitions as component dependencies or imports', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'PopupPage.tsx'),
      'export interface PopupPageProps {\n' +
        '  title: string;\n' +
        '}\n' +
        '\n' +
        'export function PopupPage(props: PopupPageProps) {\n' +
        '  return <section>{props.title}</section>;\n' +
        '}\n',
    );
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'PopupPage',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'PopupPage',
      file: 'src/components/PopupPage.tsx',
      definitionCandidates: [{ file: 'src/components/PopupPage.tsx', line: 5 }],
      dependencies: [],
      usedBy: [],
      relatedFiles: [],
      imports: [],
      exports: ['PopupPage'],
    });
  });

  test('returns definitions for a non-exported local type alias', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'LocalCard.tsx'),
      'type LocalCardProps = { label: string };\n' +
        '\n' +
        'function LocalCard(props: LocalCardProps) {\n' +
        '  return <section>{props.label}</section>;\n' +
        '}\n' +
        '\n' +
        'export function LocalCardHost() {\n' +
        '  return <LocalCard label="Hi" />;\n' +
        '}\n',
    );
    mockReadySnapshot(await createSemanticArtifact());

    const result = await queryTypeDefinition(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      typeName: 'LocalCardProps',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      typeName: 'LocalCardProps',
      definitionCandidates: [{ file: 'src/components/LocalCard.tsx', line: 1, kind: 'type' }],
      usedIn: [],
      relatedFiles: [],
    });
  });

  test('tracks dynamic import consumers in file metadata and component context', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'LazyButton.tsx'),
      'export function LazyButton() {\n' + '  return <button />;\n' + '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'LazyHost.tsx'),
      'import { lazy } from "react";\n' +
        '\n' +
        'const LazyButton = lazy(() => import("../components/LazyButton").then((module) => ({ default: module.LazyButton })));\n' +
        '\n' +
        'export function LazyHost() {\n' +
        '  return <LazyButton />;\n' +
        '}\n',
    );

    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    expect(artifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/screens/LazyHost.tsx',
          imports: ['react', '../components/LazyButton'],
          localDependencies: ['src/components/LazyButton.tsx'],
        }),
      ]),
    );

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'LazyButton',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual(['src/screens/LazyHost.tsx']);
    expect(result.payload?.relatedFiles).toContain('src/screens/LazyHost.tsx');
  });

  test('tracks bare dynamic import consumers for default-exported lazy components', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'BareLazyButton.tsx'),
      'export default function BareLazyButton() {\n' + '  return <button />;\n' + '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'BareLazyHost.tsx'),
      'import { lazy } from "react";\n' +
        '\n' +
        'const BareLazyButton = lazy(() => import("../components/BareLazyButton"));\n' +
        '\n' +
        'export function BareLazyHost() {\n' +
        '  return <BareLazyButton />;\n' +
        '}\n',
    );

    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'BareLazyButton',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual(['src/screens/BareLazyHost.tsx']);
    expect(result.payload?.relatedFiles).toContain('src/screens/BareLazyHost.tsx');
  });

  test('returns context for lazy wrapped exported components', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'Dashboard.tsx'),
      'export default function Dashboard() {\n' + '  return <main />;\n' + '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'RouteEntries.tsx'),
      'import { lazy } from "react";\n' +
        '\n' +
        'export const DashboardPage = lazy(() => import("../components/Dashboard"));\n',
    );

    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'DashboardPage',
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      component: 'DashboardPage',
      file: 'src/screens/RouteEntries.tsx',
      definitionCandidates: [{ file: 'src/screens/RouteEntries.tsx', line: 3 }],
      dependencies: ['src/components/Dashboard.tsx'],
      usedBy: [],
      relatedFiles: ['src/components/Dashboard.tsx'],
      imports: ['default'],
      exports: ['DashboardPage'],
    });
  });

  test('does not report dynamic import consumers for untouched sibling exports', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'LazyWidgets.tsx'),
      'export function UsedWidget() {\n' +
        '  return <button />;\n' +
        '}\n' +
        '\n' +
        'export function UnusedWidget() {\n' +
        '  return <aside />;\n' +
        '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'LazyWidgetsHost.tsx'),
      'import { lazy } from "react";\n' +
        '\n' +
        'const UsedWidget = lazy(() => import("../components/LazyWidgets").then((module) => ({ default: module.UsedWidget })));\n' +
        '\n' +
        'export function LazyWidgetsHost() {\n' +
        '  return <UsedWidget />;\n' +
        '}\n',
    );

    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    const usedResult = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'UsedWidget',
    });
    const unusedResult = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'UnusedWidget',
    });

    expect(usedResult.status).toBe('ready');
    expect(usedResult.payload?.usedBy).toEqual(['src/screens/LazyWidgetsHost.tsx']);
    expect(unusedResult.status).toBe('ready');
    expect(unusedResult.payload?.usedBy).toEqual([]);
    expect(unusedResult.payload?.relatedFiles).not.toContain('src/screens/LazyWidgetsHost.tsx');
  });

  test('tracks require consumers in file metadata and component context', async () => {
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'components', 'LegacyWidget.tsx'),
      'export function LegacyWidget() {\n' + '  return <aside />;\n' + '}\n',
    );
    await fs.writeFile(
      path.join(snapshotDir, 'src', 'screens', 'RequireHost.tsx'),
      'const { LegacyWidget } = require("../components/LegacyWidget");\n' +
        '\n' +
        'export function RequireHost() {\n' +
        '  return <LegacyWidget />;\n' +
        '}\n',
    );

    const artifact = await createSemanticArtifact();
    mockReadySnapshot(artifact);

    expect(artifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/screens/RequireHost.tsx',
          imports: ['../components/LegacyWidget'],
          localDependencies: ['src/components/LegacyWidget.tsx'],
        }),
      ]),
    );

    const result = await queryComponentContext(scope, {
      productKey: 'crm',
      exactVersion: 'v1.0.0',
      componentName: 'LegacyWidget',
    });

    expect(result.status).toBe('ready');
    expect(result.payload?.usedBy).toEqual(['src/screens/RequireHost.tsx']);
    expect(result.payload?.relatedFiles).toContain('src/screens/RequireHost.tsx');
  });

  test('returns failed status when the ready artifact is missing semantic arrays', async () => {
    const invalidArtifact = {
      format: 'source-tree-v2',
      snapshotVersionId: 101,
      generatedAt: '2024-01-01T00:00:00.000Z',
      summary: {
        fileCount: 1,
        totalBytes: 64,
        frameworkHints: ['react'],
        routingMode: 'unknown',
        warnings: [],
      },
      files: [
        {
          path: 'package.json',
          size: 64,
          ext: '.json',
          imports: [],
          localDependencies: [],
        },
      ],
    };

    mockReadySnapshot(invalidArtifact);

    const statusResult = await getSourceIndexStatus(scope, { productKey: 'crm', selector: 'latest' });
    const summaryResult = await queryCodebaseSummary(scope, { productKey: 'crm', selector: 'latest' });

    expect(statusResult).toEqual({
      status: 'failed',
      warnings: ['Source index artifact has an unsupported format'],
      payload: {
        generatedAt: '2024-01-01T00:00:00.000Z',
        errorMessage: 'Source index artifact has an unsupported format',
      },
    });
    expect(summaryResult).toEqual({
      status: 'failed',
      warnings: ['Source index artifact has an unsupported format'],
      payload: null,
    });
  });

  test('returns failed status when file entries miss finalized metadata fields', async () => {
    const invalidArtifact = {
      format: 'source-tree-v2',
      snapshotVersionId: 101,
      generatedAt: '2024-01-01T00:00:00.000Z',
      summary: {
        fileCount: 1,
        totalBytes: 64,
        frameworkHints: ['react'],
        routingMode: 'unknown',
        warnings: [],
      },
      files: [
        {
          path: 'package.json',
          size: 64,
        },
      ],
      definitions: [],
      usages: [],
    };

    mockReadySnapshot(invalidArtifact);

    const statusResult = await getSourceIndexStatus(scope, { productKey: 'crm', selector: 'latest' });

    expect(statusResult).toEqual({
      status: 'failed',
      warnings: ['Source index artifact has an unsupported format'],
      payload: {
        generatedAt: '2024-01-01T00:00:00.000Z',
        errorMessage: 'Source index artifact has an unsupported format',
      },
    });
  });

  test('returns search results with line context from snapshot files', async () => {
    mockReadySnapshot(await createSemanticArtifact());

    const result = await searchSourceWithContext(scope, {
      productKey: 'crm',
      selector: 'default',
      query: 'needle-here',
      contextLines: 1,
    });

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual({
      query: 'needle-here',
      results: [
        {
          path: 'src/screens/Search.tsx',
          matches: [
            {
              line: 1,
              content: 'const state = "needle-here";',
              contextBefore: [],
              contextAfter: ['export function SearchPage() {'],
            },
            {
              line: 3,
              content: '  return <div>needle-here</div>;',
              contextBefore: ['export function SearchPage() {'],
              contextAfter: ['}'],
            },
          ],
        },
      ],
      truncated: false,
    });
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'default');
  });

  test('returns structured non-ready status when index is pending without scheduling a backfill from the query path', async () => {
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
    expect(resolvePublishedSnapshotVersionMock).toHaveBeenCalledWith(scope, 'crm', 'latest');
  });
});
