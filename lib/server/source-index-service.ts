import fs from 'node:fs/promises';

import { ensureChildPath } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import type { McpAccessScope } from '@/lib/server/mcp-api-key-service';
import { resolvePublishedSnapshotVersion } from '@/lib/server/source-snapshot-service';

const SOURCE_INDEX_ARTIFACT_KEY = 'source-tree-v1';
const MAX_SEARCH_RESULTS = 50;
const MAX_CONTEXT_LINES = 10;
const MAX_SEARCH_FILE_BYTES = 128 * 1024;

type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';
type VersionSelectorInput = 'default' | 'latest' | { exact: string };

type IndexedComponentCandidate = {
  name: string;
  line: number;
};

type IndexedTypeCandidate = {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
};

type IndexedMockCandidate = {
  name: string;
  kind: string;
  line: number;
  reason: 'path-pattern' | 'name-pattern';
};

type SourceIndexFileEntry = {
  path: string;
  size: number;
  ext: string;
  imports: string[];
  exports: string[];
  localDependencies: string[];
  symbols: {
    components: IndexedComponentCandidate[];
    types: IndexedTypeCandidate[];
    mocks: IndexedMockCandidate[];
  };
};

type SourceIndexArtifact = {
  format: typeof SOURCE_INDEX_ARTIFACT_KEY;
  snapshotVersionId: number;
  generatedAt: string;
  summary: {
    fileCount: number;
    totalBytes: number;
    frameworkHints: string[];
    routingMode: 'next-app-router' | 'next-pages-router' | 'react-router' | 'app-tsx-state' | 'unknown';
    warnings: string[];
    languages?: Record<string, number>;
  };
  files: SourceIndexFileEntry[];
};

type SourceIndexSelection = {
  productKey: string;
  selector?: 'default' | 'latest';
  exactVersion?: string;
};

type QueryResult<T> = {
  status: IndexStatus;
  warnings: string[];
  payload: T | null;
};

type LoadedIndexContext = {
  rootPath: string;
  status: IndexStatus;
  generatedAt: string | null;
  errorMessage: string | null;
  warnings: string[];
  artifact: SourceIndexArtifact | null;
};

type ComponentContextInput = SourceIndexSelection & {
  componentName: string;
};

type TypeDefinitionInput = SourceIndexSelection & {
  typeName: string;
};

type SearchWithContextInput = SourceIndexSelection & {
  query: string;
  contextLines?: number;
};

function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

function isProbablyText(buffer: Buffer) {
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      return false;
    }
  }

  return true;
}

function normalizeQueryStatus(status?: string | null): IndexStatus {
  if (status === 'indexing' || status === 'ready' || status === 'failed') {
    return status;
  }

  return 'pending';
}

function resolveVersionSelector(input: SourceIndexSelection): VersionSelectorInput {
  if (input.exactVersion) {
    return { exact: input.exactVersion };
  }

  return input.selector ?? 'default';
}

function inferPrimaryFramework(hints: string[]) {
  if (hints.includes('next')) return 'next';
  if (hints.includes('react')) return 'react';
  if (hints.includes('vue')) return 'vue';
  if (hints.includes('nuxt')) return 'nuxt';
  if (hints.includes('svelte')) return 'svelte';
  return hints[0] ?? 'unknown';
}

function collectKeyFiles(files: SourceIndexFileEntry[]) {
  return dedupeStrings(
    files
      .filter(
        (file) =>
          file.path === 'package.json' ||
          file.symbols.components.length > 0 ||
          file.symbols.types.length > 0 ||
          file.symbols.mocks.length > 0 ||
          /(?:^|\/)App\.(?:tsx|jsx|ts|js)$/.test(file.path),
      )
      .map((file) => file.path),
  ).sort((left, right) => left.localeCompare(right));
}

function nonReadyResult<T>(status: IndexStatus, warnings: string[]): QueryResult<T> {
  return {
    status,
    warnings,
    payload: null,
  };
}

async function loadIndexContext(scope: McpAccessScope, input: SourceIndexSelection): Promise<LoadedIndexContext> {
  const selector = resolveVersionSelector(input);
  const resolved = await resolvePublishedSnapshotVersion(scope, input.productKey, selector);

  const versionRecord = await prisma.productVersion.findFirst({
    where: {
      version: resolved.version,
      status: 'published',
      product: {
        key: input.productKey,
        ownerId: scope.userId,
        id: {
          in: scope.allowedProductIds,
        },
      },
      sourceSnapshot: {
        is: {
          status: 'ready',
        },
      },
    },
    select: {
      sourceSnapshot: {
        select: {
          indexStatus: true,
          indexGeneratedAt: true,
          indexErrorMessage: true,
          indexArtifacts: {
            where: {
              artifactKey: SOURCE_INDEX_ARTIFACT_KEY,
            },
            orderBy: {
              updatedAt: 'desc',
            },
            take: 1,
            select: {
              status: true,
              errorMessage: true,
              contentJson: true,
            },
          },
        },
      },
    },
  });

  const snapshot = versionRecord?.sourceSnapshot;
  const status = normalizeQueryStatus(snapshot?.indexStatus);
  const warnings: string[] = [];

  if (!snapshot) {
    return {
      rootPath: resolved.rootPath,
      status: 'failed',
      generatedAt: null,
      errorMessage: 'Source snapshot metadata is unavailable',
      warnings: ['Source snapshot metadata is unavailable'],
      artifact: null,
    };
  }

  const baseResult: LoadedIndexContext = {
    rootPath: resolved.rootPath,
    status,
    generatedAt: snapshot.indexGeneratedAt ? snapshot.indexGeneratedAt.toISOString() : null,
    errorMessage: snapshot.indexErrorMessage,
    warnings,
    artifact: null,
  };

  if (status !== 'ready') {
    if (snapshot.indexErrorMessage) {
      warnings.push(snapshot.indexErrorMessage);
    }
    return baseResult;
  }

  const artifactRecord = snapshot.indexArtifacts[0];
  if (!artifactRecord || artifactRecord.status !== 'ready') {
    warnings.push('Source index artifact is missing');
    return {
      ...baseResult,
      status: 'failed',
      warnings,
      errorMessage: artifactRecord?.errorMessage ?? 'Source index artifact is missing',
    };
  }

  try {
    const parsed = JSON.parse(artifactRecord.contentJson) as SourceIndexArtifact;
    if (parsed.format !== SOURCE_INDEX_ARTIFACT_KEY || !Array.isArray(parsed.files) || !parsed.summary) {
      warnings.push('Source index artifact has an unsupported format');
      return {
        ...baseResult,
        status: 'failed',
        warnings,
        errorMessage: 'Source index artifact has an unsupported format',
      };
    }

    return {
      ...baseResult,
      artifact: parsed,
      warnings: dedupeStrings([...warnings, ...(parsed.summary.warnings ?? [])]),
    };
  } catch {
    warnings.push('Source index artifact content is invalid');
    return {
      ...baseResult,
      status: 'failed',
      warnings,
      errorMessage: 'Source index artifact content is invalid',
    };
  }
}

async function estimateDatasetCount(rootPath: string, filePath: string, symbol: string) {
  try {
    const text = await fs.readFile(ensureChildPath(rootPath, filePath), 'utf8');
    const symbolPattern = new RegExp(`\\b${symbol}\\b\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const match = text.match(symbolPattern);
    if (!match) {
      return 1;
    }

    const itemMatches = match[1].match(/{/g);
    return itemMatches?.length ?? 1;
  } catch {
    return 1;
  }
}

export async function getSourceIndexStatus(scope: McpAccessScope, input: SourceIndexSelection) {
  const context = await loadIndexContext(scope, input);
  return {
    status: context.status,
    warnings: context.warnings,
    payload: {
      generatedAt: context.generatedAt,
      errorMessage: context.errorMessage,
    },
  } satisfies QueryResult<{
    generatedAt: string | null;
    errorMessage: string | null;
  }>;
}

export async function queryCodebaseSummary(scope: McpAccessScope, input: SourceIndexSelection) {
  const context = await loadIndexContext(scope, input);
  if (context.status !== 'ready' || !context.artifact) {
    return nonReadyResult<{
      framework: string;
      techStack: string[];
      routing: { mode: SourceIndexArtifact['summary']['routingMode'] };
      counts: { files: number; totalBytes: number };
      keyFiles: string[];
      warnings: string[];
    }>(context.status, context.warnings);
  }

  return {
    status: 'ready',
    warnings: context.warnings,
    payload: {
      framework: inferPrimaryFramework(context.artifact.summary.frameworkHints),
      techStack: context.artifact.summary.frameworkHints,
      routing: {
        mode: context.artifact.summary.routingMode,
      },
      counts: {
        files: context.artifact.summary.fileCount,
        totalBytes: context.artifact.summary.totalBytes,
      },
      keyFiles: collectKeyFiles(context.artifact.files),
      warnings: context.warnings,
    },
  } satisfies QueryResult<{
    framework: string;
    techStack: string[];
    routing: { mode: SourceIndexArtifact['summary']['routingMode'] };
    counts: { files: number; totalBytes: number };
    keyFiles: string[];
    warnings: string[];
  }>;
}

export async function queryComponentContext(scope: McpAccessScope, input: ComponentContextInput) {
  const context = await loadIndexContext(scope, input);
  if (context.status !== 'ready' || !context.artifact) {
    return nonReadyResult<{
      component: string;
      file: string | null;
      definitionCandidates: Array<{ file: string; line: number }>;
      dependencies: string[];
      usedBy: string[];
      relatedFiles: string[];
      imports: string[];
      exports: string[];
    }>(context.status, context.warnings);
  }

  const loweredName = input.componentName.toLowerCase();
  const definitionCandidates = context.artifact.files
    .flatMap((file) =>
      file.symbols.components
        .filter((component) => component.name.toLowerCase() === loweredName)
        .map((component) => ({ file: file.path, line: component.line })),
    )
    .sort((left, right) => left.file.localeCompare(right.file));
  const definitionPaths = new Set(definitionCandidates.map((item) => item.file));
  const definitionFiles = context.artifact.files.filter((file) => definitionPaths.has(file.path));
  const dependencies = dedupeStrings(definitionFiles.flatMap((file) => file.localDependencies)).sort();
  const usedBy = context.artifact.files
    .filter((file) => file.localDependencies.some((dependency) => definitionPaths.has(dependency)))
    .map((file) => file.path)
    .sort();
  const relatedFiles = dedupeStrings([...dependencies, ...usedBy].filter((filePath) => !definitionPaths.has(filePath))).sort();
  const imports = dedupeStrings(definitionFiles.flatMap((file) => file.imports)).sort();
  const exports = dedupeStrings(definitionFiles.flatMap((file) => file.exports)).sort();

  return {
    status: 'ready',
    warnings: context.warnings,
    payload: {
      component: input.componentName,
      file: definitionCandidates[0]?.file ?? null,
      definitionCandidates,
      dependencies,
      usedBy,
      relatedFiles,
      imports,
      exports,
    },
  } satisfies QueryResult<{
    component: string;
    file: string | null;
    definitionCandidates: Array<{ file: string; line: number }>;
    dependencies: string[];
    usedBy: string[];
    relatedFiles: string[];
    imports: string[];
    exports: string[];
  }>;
}

export async function queryTypeDefinition(scope: McpAccessScope, input: TypeDefinitionInput) {
  const context = await loadIndexContext(scope, input);
  if (context.status !== 'ready' || !context.artifact) {
    return nonReadyResult<{
      typeName: string;
      definitionCandidates: Array<{ file: string; line: number; kind: IndexedTypeCandidate['kind'] }>;
      usedIn: string[];
      relatedFiles: string[];
    }>(context.status, context.warnings);
  }

  const loweredName = input.typeName.toLowerCase();
  const definitionCandidates = context.artifact.files
    .flatMap((file) =>
      file.symbols.types
        .filter((type) => type.name.toLowerCase() === loweredName)
        .map((type) => ({ file: file.path, line: type.line, kind: type.kind })),
    )
    .sort((left, right) => left.file.localeCompare(right.file));
  const definitionPaths = new Set(definitionCandidates.map((item) => item.file));
  const usedIn = context.artifact.files
    .filter((file) => file.localDependencies.some((dependency) => definitionPaths.has(dependency)))
    .map((file) => file.path)
    .sort();
  const relatedFiles = dedupeStrings(usedIn.filter((filePath) => !definitionPaths.has(filePath))).sort();

  return {
    status: 'ready',
    warnings: context.warnings,
    payload: {
      typeName: input.typeName,
      definitionCandidates,
      usedIn,
      relatedFiles,
    },
  } satisfies QueryResult<{
    typeName: string;
    definitionCandidates: Array<{ file: string; line: number; kind: IndexedTypeCandidate['kind'] }>;
    usedIn: string[];
    relatedFiles: string[];
  }>;
}

export async function queryMockDataSummary(scope: McpAccessScope, input: SourceIndexSelection) {
  const context = await loadIndexContext(scope, input);
  if (context.status !== 'ready' || !context.artifact) {
    return nonReadyResult<{
      totalDatasets: number;
      files: Array<{
        file: string;
        datasetCount: number;
        datasets: Array<{ name: string; count: number; typeHint: string; line: number; reason: IndexedMockCandidate['reason'] }>;
      }>;
    }>(context.status, context.warnings);
  }

  const files = await Promise.all(
    context.artifact.files
      .filter((file) => file.symbols.mocks.length > 0)
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(async (file) => {
        const datasets = await Promise.all(
          file.symbols.mocks.map(async (symbol) => ({
            name: symbol.name,
            count: await estimateDatasetCount(context.rootPath, file.path, symbol.name),
            typeHint: symbol.kind,
            line: symbol.line,
            reason: symbol.reason,
          })),
        );

        return {
          file: file.path,
          datasetCount: datasets.length,
          datasets,
        };
      }),
  );

  const totalDatasets = files.reduce((sum, file) => sum + file.datasetCount, 0);

  return {
    status: 'ready',
    warnings: context.warnings,
    payload: {
      totalDatasets,
      files,
    },
  } satisfies QueryResult<{
    totalDatasets: number;
    files: Array<{
      file: string;
      datasetCount: number;
      datasets: Array<{ name: string; count: number; typeHint: string; line: number; reason: IndexedMockCandidate['reason'] }>;
    }>;
  }>;
}

export async function searchSourceWithContext(scope: McpAccessScope, input: SearchWithContextInput) {
  const context = await loadIndexContext(scope, input);
  if (context.status !== 'ready' || !context.artifact) {
    return nonReadyResult<{
      query: string;
      results: Array<{
        path: string;
        matches: Array<{
          line: number;
          content: string;
          contextBefore: string[];
          contextAfter: string[];
        }>;
      }>;
      truncated: boolean;
    }>(context.status, context.warnings);
  }

  const normalizedQuery = input.query.trim();
  if (!normalizedQuery) {
    return {
      status: 'ready',
      warnings: context.warnings,
      payload: {
        query: input.query,
        results: [],
        truncated: false,
      },
    } satisfies QueryResult<{
      query: string;
      results: Array<{
        path: string;
        matches: Array<{
          line: number;
          content: string;
          contextBefore: string[];
          contextAfter: string[];
        }>;
      }>;
      truncated: boolean;
    }>;
  }

  const loweredQuery = normalizedQuery.toLowerCase();
  const contextLines = Math.max(0, Math.min(Math.trunc(input.contextLines ?? 2), MAX_CONTEXT_LINES));
  const warnings = [...context.warnings];
  const groupedResults: Array<{
    path: string;
    matches: Array<{
      line: number;
      content: string;
      contextBefore: string[];
      contextAfter: string[];
    }>;
  }> = [];
  let totalMatches = 0;
  let truncated = false;

  for (const file of context.artifact.files) {
    if (totalMatches >= MAX_SEARCH_RESULTS) {
      truncated = true;
      break;
    }

    if (file.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    let text: string;
    try {
      const buffer = await fs.readFile(ensureChildPath(context.rootPath, file.path));
      if (buffer.length > MAX_SEARCH_FILE_BYTES || !isProbablyText(buffer)) {
        continue;
      }

      text = buffer.toString('utf8');
    } catch {
      warnings.push(`Unable to read ${file.path} while collecting search context`);
      continue;
    }

    const lines = text.split(/\r?\n/);
    const matches: Array<{
      line: number;
      content: string;
      contextBefore: string[];
      contextAfter: string[];
    }> = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (totalMatches >= MAX_SEARCH_RESULTS) {
        truncated = true;
        break;
      }

      if (!lines[lineIndex].toLowerCase().includes(loweredQuery)) {
        continue;
      }

      const start = Math.max(0, lineIndex - contextLines);
      const end = Math.min(lines.length - 1, lineIndex + contextLines);
      matches.push({
        line: lineIndex + 1,
        content: lines[lineIndex],
        contextBefore: lines.slice(start, lineIndex),
        contextAfter: lines.slice(lineIndex + 1, end + 1),
      });
      totalMatches += 1;
    }

    if (matches.length > 0) {
      groupedResults.push({
        path: file.path,
        matches,
      });
    }
  }

  return {
    status: 'ready',
    warnings: dedupeStrings(warnings),
    payload: {
      query: input.query,
      results: groupedResults,
      truncated,
    },
  } satisfies QueryResult<{
    query: string;
    results: Array<{
      path: string;
      matches: Array<{
        line: number;
        content: string;
        contextBefore: string[];
        contextAfter: string[];
      }>;
    }>;
    truncated: boolean;
  }>;
}
