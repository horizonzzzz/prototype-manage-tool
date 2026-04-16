import fs from 'node:fs/promises';

import { ensureChildPath } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import type { McpAccessScope } from '@/lib/server/mcp-api-key-service';
import { ensureSourceIndexBackfillScheduled } from '@/lib/server/source-index-queue';
import { resolvePublishedSnapshotVersion } from '@/lib/server/source-snapshot-service';
import {
  MAX_CONTEXT_LINES,
  MAX_SEARCH_FILE_BYTES,
  MAX_SEARCH_RESULTS,
  SOURCE_INDEX_ARTIFACT_KEY,
  type IndexStatus,
  type SourceIndexArtifact,
  type SourceIndexDefinition,
  type SourceIndexFileEntry,
  type SourceIndexUsage,
  dedupeStrings,
  isProbablyText,
} from '@/lib/server/source-index-types';

// Re-export for backward compatibility - import from source modules directly
export { scheduleSourceSnapshotIndexBuild, ensureSourceIndexBackfillScheduled } from '@/lib/server/source-index-queue';
export { rebuildSourceSnapshotIndex } from '@/lib/server/source-index-builder';

type VersionSelectorInput = 'default' | 'latest' | { exact: string };

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

type LoadedSourceIndexArtifact = SourceIndexArtifact;

type LoadedIndexContext = {
  rootPath: string;
  status: IndexStatus;
  generatedAt: string | null;
  errorMessage: string | null;
  warnings: string[];
  artifact: LoadedSourceIndexArtifact | null;
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

const TYPE_DEFINITION_KINDS = new Set<SourceIndexDefinition['kind']>(['interface', 'type', 'enum']);

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isIndexedFileEntry(value: unknown): value is SourceIndexFileEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SourceIndexFileEntry>;
  return (
    typeof candidate.path === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.ext === 'string' &&
    isStringArray(candidate.imports) &&
    isStringArray(candidate.localDependencies)
  );
}

function isSourceIndexDefinition(value: unknown): value is SourceIndexDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SourceIndexDefinition>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.file === 'string' &&
    typeof candidate.line === 'number' &&
    Array.isArray(candidate.exportNames) &&
    candidate.exportNames.every((name) => typeof name === 'string') &&
    typeof candidate.isDefaultExport === 'boolean'
  );
}

function isSourceIndexUsage(value: unknown): value is SourceIndexUsage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SourceIndexUsage>;
  return (
    (typeof candidate.definitionId === 'string' || candidate.definitionId === null) &&
    typeof candidate.file === 'string' &&
    typeof candidate.symbol === 'string' &&
    (typeof candidate.targetFile === 'string' || candidate.targetFile === null) &&
    typeof candidate.line === 'number' &&
    typeof candidate.kind === 'string'
  );
}

function isLoadedSourceIndexArtifact(value: unknown): value is LoadedSourceIndexArtifact {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LoadedSourceIndexArtifact>;
  return (
    candidate.format === SOURCE_INDEX_ARTIFACT_KEY &&
    Boolean(candidate.summary) &&
    typeof candidate.summary?.fileCount === 'number' &&
    typeof candidate.summary?.totalBytes === 'number' &&
    isStringArray(candidate.summary?.frameworkHints) &&
    typeof candidate.summary?.routingMode === 'string' &&
    isStringArray(candidate.summary?.warnings) &&
    Array.isArray(candidate.files) &&
    candidate.files.every(isIndexedFileEntry) &&
    Array.isArray(candidate.definitions) &&
    candidate.definitions.every(isSourceIndexDefinition) &&
    Array.isArray(candidate.usages) &&
    candidate.usages.every(isSourceIndexUsage)
  );
}

function collectKeyFiles(artifact: LoadedSourceIndexArtifact) {
  const semanticKeyFiles = artifact.definitions.map((definition) => definition.file);
  const conventionalKeyFiles = artifact.files.filter((file) => file.path === 'package.json').map((file) => file.path);

  return dedupeStrings([...semanticKeyFiles, ...conventionalKeyFiles]).sort((left, right) => left.localeCompare(right));
}

function nonReadyResult<T>(status: IndexStatus, warnings: string[]): QueryResult<T> {
  return {
    status,
    warnings,
    payload: null,
  };
}

function sortDefinitions(definitions: SourceIndexDefinition[]) {
  return [...definitions].sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    return left.id.localeCompare(right.id);
  });
}

function dedupeFileLineCandidates<T extends { file: string; line: number }>(candidates: T[]) {
  const deduped = new Map<string, T>();
  for (const candidate of candidates) {
    deduped.set(`${candidate.file}:${candidate.line}`, candidate);
  }

  return [...deduped.values()].sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    return left.line - right.line;
  });
}

function selectDefinitionsByName(
  artifact: LoadedSourceIndexArtifact,
  symbolName: string,
  predicate: (definition: SourceIndexDefinition) => boolean,
) {
  const loweredName = symbolName.toLowerCase();
  return sortDefinitions(
    artifact.definitions.filter(
      (definition) => predicate(definition) && definition.name.toLowerCase() === loweredName,
    ),
  );
}

function getDefinitionsById(artifact: LoadedSourceIndexArtifact) {
  return new Map(artifact.definitions.map((definition) => [definition.id, definition] as const));
}

function collectUsageFiles(usages: SourceIndexUsage[], definitions: SourceIndexDefinition[]) {
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const definitionFiles = new Set(definitions.map((definition) => definition.file));
  return dedupeStrings(
    usages
      .filter((usage) => usage.definitionId !== null && definitionIds.has(usage.definitionId))
      .map((usage) => usage.file)
      .filter((filePath) => !definitionFiles.has(filePath)),
  ).sort((left, right) => left.localeCompare(right));
}

function collectReferencedDefinitions(
  artifact: LoadedSourceIndexArtifact,
  sourceFiles: Set<string>,
  excludedDefinitionIds: Set<string>,
) {
  const definitionsById = getDefinitionsById(artifact);
  const collected = new Map<string, SourceIndexDefinition>();

  for (const usage of artifact.usages) {
    if (!sourceFiles.has(usage.file) || usage.definitionId === null || excludedDefinitionIds.has(usage.definitionId)) {
      continue;
    }

    const definition = definitionsById.get(usage.definitionId);
    if (!definition) {
      continue;
    }

    collected.set(definition.id, definition);
  }

  return sortDefinitions([...collected.values()]);
}

async function loadIndexContext(scope: McpAccessScope, input: SourceIndexSelection): Promise<LoadedIndexContext> {
  await ensureSourceIndexBackfillScheduled();
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
    const parsed = JSON.parse(artifactRecord.contentJson) as unknown;
    if (!isLoadedSourceIndexArtifact(parsed)) {
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
      warnings: dedupeStrings([...warnings, ...parsed.summary.warnings]),
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
      keyFiles: collectKeyFiles(context.artifact),
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

  const definitions = selectDefinitionsByName(context.artifact, input.componentName, (definition) => definition.kind === 'component');
  const definitionCandidates = dedupeFileLineCandidates(
    definitions.map((definition) => ({ file: definition.file, line: definition.line })),
  );
  const definitionPaths = new Set(definitions.map((definition) => definition.file));
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const referencedDefinitions = collectReferencedDefinitions(context.artifact, definitionPaths, definitionIds);
  const dependencies = dedupeStrings(referencedDefinitions.map((definition) => definition.file)).sort((left, right) =>
    left.localeCompare(right),
  );
  const usedBy = collectUsageFiles(context.artifact.usages, definitions);
  const relatedFiles = dedupeStrings([...dependencies, ...usedBy].filter((filePath) => !definitionPaths.has(filePath))).sort(
    (left, right) => left.localeCompare(right),
  );
  const imports = dedupeStrings(
    referencedDefinitions.flatMap((definition) => (definition.exportNames.length > 0 ? definition.exportNames : [definition.name])),
  ).sort((left, right) => left.localeCompare(right));
  const exports = dedupeStrings(
    definitions
      .filter((definition) => definition.exportNames.length > 0)
      .flatMap((definition) => definition.exportNames),
  ).sort((left, right) => left.localeCompare(right));

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
      definitionCandidates: Array<{ file: string; line: number; kind: 'interface' | 'type' | 'enum' }>;
      usedIn: string[];
      relatedFiles: string[];
    }>(context.status, context.warnings);
  }

  const definitions = selectDefinitionsByName(context.artifact, input.typeName, (definition) =>
    TYPE_DEFINITION_KINDS.has(definition.kind),
  );
  const definitionCandidates = dedupeFileLineCandidates(
    definitions.map((definition) => ({
      file: definition.file,
      line: definition.line,
      kind: definition.kind as 'interface' | 'type' | 'enum',
    })),
  );
  const definitionPaths = new Set(definitions.map((definition) => definition.file));
  const usedIn = collectUsageFiles(context.artifact.usages, definitions);
  const relatedFiles = dedupeStrings(usedIn.filter((filePath) => !definitionPaths.has(filePath))).sort((left, right) =>
    left.localeCompare(right),
  );

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
    definitionCandidates: Array<{ file: string; line: number; kind: 'interface' | 'type' | 'enum' }>;
    usedIn: string[];
    relatedFiles: string[];
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
