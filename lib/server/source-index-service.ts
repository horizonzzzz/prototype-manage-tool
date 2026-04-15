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
  type SourceIndexFileEntry,
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

type LoadedSourceIndexFileEntry = SourceIndexFileEntry & {
  hasStructuredImportEntries: boolean;
  hasStructuredReExportEntries: boolean;
};

type LoadedSourceIndexArtifact = Omit<SourceIndexArtifact, 'files'> & {
  files: LoadedSourceIndexFileEntry[];
};

type LoadedIndexContext = {
  rootPath: string;
  status: IndexStatus;
  generatedAt: string | null;
  errorMessage: string | null;
  warnings: string[];
  artifact: LoadedSourceIndexArtifact | null;
};

type LocalExportEntry = {
  localName: string;
  exportedName: string;
  isTypeOnly: boolean;
};

type FileSourceAnalysis = {
  source: string | null;
  localExportEntries: LocalExportEntry[];
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
          /(?:^|\/)App\.(?:tsx|jsx|ts|js)$/.test(file.path),
      )
      .map((file) => file.path),
  ).sort((left, right) => left.localeCompare(right));
}

type IndexedSymbolKind = 'component' | 'type';

function getImportEntries(file: SourceIndexFileEntry) {
  return Array.isArray(file.importEntries) ? file.importEntries : [];
}

function getReExportEntries(file: SourceIndexFileEntry) {
  return Array.isArray(file.reExportEntries) ? file.reExportEntries : [];
}

function parseLocalExportEntries(source: string): LocalExportEntry[] {
  const entries: LocalExportEntry[] = [];
  const localNamedExportRegex = /\bexport\s+(type\s+)?{\s*([^}]+)\s*}(?!\s*from\b)/g;

  let match: RegExpExecArray | null;
  while ((match = localNamedExportRegex.exec(source)) !== null) {
    const defaultTypeOnly = Boolean(match[1]);
    const bindings = match[2]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const rawBinding of bindings) {
      const isTypeOnly = defaultTypeOnly || rawBinding.startsWith('type ');
      const normalizedBinding = isTypeOnly && rawBinding.startsWith('type ') ? rawBinding.slice(5).trim() : rawBinding;
      const [localName, exportedName] = normalizedBinding.split(/\s+as\s+/i).map((part) => part.trim());

      if (!localName) {
        continue;
      }

      entries.push({
        localName,
        exportedName: exportedName ?? localName,
        isTypeOnly,
      });
    }
  }

  return entries;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceReferencesNamespaceSymbol(source: string, namespaceAlias: string, symbolName: string) {
  const referencePattern = new RegExp(`\\b${escapeRegex(namespaceAlias)}\\s*\\.\\s*${escapeRegex(symbolName)}\\b`);
  return referencePattern.test(source);
}

async function getFileSourceAnalysis(
  rootPath: string,
  filePath: string,
  cache: Map<string, Promise<FileSourceAnalysis>>,
): Promise<FileSourceAnalysis> {
  const cached = cache.get(filePath);
  if (cached) {
    return cached;
  }

  const pending = fs
    .readFile(ensureChildPath(rootPath, filePath), 'utf8')
    .then((source) => ({
      source,
      localExportEntries: parseLocalExportEntries(source),
    }))
    .catch(() => ({
      source: null,
      localExportEntries: [],
    }));

  cache.set(filePath, pending);
  return pending;
}

function fileHasLegacyUsageOnly(file: LoadedSourceIndexFileEntry) {
  return !file.hasStructuredImportEntries && !file.hasStructuredReExportEntries;
}

function fileDefinesSymbol(file: SourceIndexFileEntry, symbolName: string, kind: IndexedSymbolKind) {
  const loweredName = symbolName.toLowerCase();
  if (kind === 'component') {
    return file.symbols.components.some((component) => component.name.toLowerCase() === loweredName);
  }

  return file.symbols.types.some((type) => type.name.toLowerCase() === loweredName);
}

async function fileProvidesSymbol(
  rootPath: string,
  filePath: string,
  symbolName: string,
  kind: IndexedSymbolKind,
  filesByPath: Map<string, SourceIndexFileEntry>,
  cache: Map<string, boolean>,
  sourceCache: Map<string, Promise<FileSourceAnalysis>>,
  ancestry = new Set<string>(),
): Promise<boolean> {
  const cacheKey = `${kind}:${filePath}:${symbolName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (typeof cached === 'boolean') {
    return cached;
  }

  const file = filesByPath.get(filePath);
  if (!file) {
    cache.set(cacheKey, false);
    return false;
  }

  if (fileDefinesSymbol(file, symbolName, kind)) {
    cache.set(cacheKey, true);
    return true;
  }

  if (ancestry.has(cacheKey)) {
    cache.set(cacheKey, false);
    return false;
  }

  const nextAncestry = new Set(ancestry);
  nextAncestry.add(cacheKey);

  if (file.exports.some((exportName) => exportName.toLowerCase() === symbolName.toLowerCase())) {
    const { localExportEntries } = await getFileSourceAnalysis(rootPath, file.path, sourceCache);
    const matchingLocalExports = localExportEntries.filter((entry) => {
      if (entry.exportedName.toLowerCase() !== symbolName.toLowerCase()) {
        return false;
      }

      if (kind === 'component' && entry.isTypeOnly) {
        return false;
      }

      return true;
    });

    for (const exportEntry of matchingLocalExports) {
      if (fileDefinesSymbol(file, exportEntry.localName, kind)) {
        cache.set(cacheKey, true);
        return true;
      }

      for (const entry of getImportEntries(file)) {
        if (!entry.resolvedPath || !entry.localName || entry.localName.toLowerCase() !== exportEntry.localName.toLowerCase()) {
          continue;
        }

        if (kind === 'component' && entry.isTypeOnly) {
          continue;
        }

        if (entry.kind === 'named' && entry.importedName) {
          if (await fileProvidesSymbol(rootPath, entry.resolvedPath, entry.importedName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
            cache.set(cacheKey, true);
            return true;
          }
          continue;
        }

        if (entry.kind === 'default') {
          if (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
            cache.set(cacheKey, true);
            return true;
          }
        }
      }
    }

    for (const entry of getImportEntries(file)) {
      if (!entry.resolvedPath || !entry.localName || entry.localName.toLowerCase() !== symbolName.toLowerCase()) {
        continue;
      }

      if (kind === 'component' && entry.isTypeOnly) {
        continue;
      }

      if (entry.kind === 'named' && entry.importedName) {
        if (await fileProvidesSymbol(rootPath, entry.resolvedPath, entry.importedName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
          cache.set(cacheKey, true);
          return true;
        }
        continue;
      }

      if (entry.kind === 'default') {
        if (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
          cache.set(cacheKey, true);
          return true;
        }
      }
    }
  }

  for (const entry of getReExportEntries(file)) {
    if (!entry.resolvedPath) {
      continue;
    }

    if (kind === 'component' && entry.isTypeOnly) {
      continue;
    }

    if (entry.kind === 'named') {
      if (!entry.importedName || entry.exportedName?.toLowerCase() !== symbolName.toLowerCase()) {
        continue;
      }

      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, entry.importedName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
        cache.set(cacheKey, true);
        return true;
      }
      continue;
    }

    if (entry.kind === 'all') {
      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache, nextAncestry)) {
        cache.set(cacheKey, true);
        return true;
      }
    }
  }

  cache.set(cacheKey, false);
  return false;
}

async function fileUsesSymbol(
  rootPath: string,
  file: SourceIndexFileEntry,
  symbolName: string,
  kind: IndexedSymbolKind,
  filesByPath: Map<string, SourceIndexFileEntry>,
  cache: Map<string, boolean>,
  sourceCache: Map<string, Promise<FileSourceAnalysis>>,
) {
  const loweredName = symbolName.toLowerCase();

  for (const entry of getImportEntries(file)) {
    if (!entry.resolvedPath) {
      continue;
    }

    if (kind === 'component' && entry.isTypeOnly) {
      continue;
    }

    if (entry.kind === 'named') {
      if (entry.importedName?.toLowerCase() !== loweredName) {
        continue;
      }

      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, entry.importedName, kind, filesByPath, cache, sourceCache)) {
        return true;
      }
      continue;
    }

    if (entry.kind === 'default' && kind === 'component') {
      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache)) {
        return true;
      }
      continue;
    }

    if (entry.kind === 'namespace' && entry.localName) {
      const { source } = await getFileSourceAnalysis(rootPath, file.path, sourceCache);
      if (!source || !sourceReferencesNamespaceSymbol(source, entry.localName, symbolName)) {
        continue;
      }

      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache)) {
        return true;
      }
    }
  }

  for (const entry of getReExportEntries(file)) {
    if (!entry.resolvedPath) {
      continue;
    }

    if (kind === 'component' && entry.isTypeOnly) {
      continue;
    }

    if (entry.kind === 'named') {
      if (!entry.importedName || entry.exportedName?.toLowerCase() !== loweredName) {
        continue;
      }

      if (await fileProvidesSymbol(rootPath, entry.resolvedPath, entry.importedName, kind, filesByPath, cache, sourceCache)) {
        return true;
      }
      continue;
    }

    if (entry.kind === 'all' && (await fileProvidesSymbol(rootPath, entry.resolvedPath, symbolName, kind, filesByPath, cache, sourceCache))) {
      return true;
    }
  }

  return false;
}

function nonReadyResult<T>(status: IndexStatus, warnings: string[]): QueryResult<T> {
  return {
    status,
    warnings,
    payload: null,
  };
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

    const normalizedArtifact: LoadedSourceIndexArtifact = {
      ...parsed,
      files: parsed.files.map((file) => ({
        ...file,
        hasStructuredImportEntries: Array.isArray(file.importEntries),
        hasStructuredReExportEntries: Array.isArray(file.reExportEntries),
        importEntries: Array.isArray(file.importEntries) ? file.importEntries : [],
        reExportEntries: Array.isArray(file.reExportEntries) ? file.reExportEntries : [],
      })),
    };

    return {
      ...baseResult,
      artifact: normalizedArtifact,
      warnings: dedupeStrings([...warnings, ...(normalizedArtifact.summary.warnings ?? [])]),
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
  const filesByPath = new Map(context.artifact.files.map((file) => [file.path, file] as const));
  const symbolResolutionCache = new Map<string, boolean>();
  const sourceCache = new Map<string, Promise<FileSourceAnalysis>>();
  const definitionFiles = context.artifact.files.filter((file) => definitionPaths.has(file.path));
  const dependencies = dedupeStrings(definitionFiles.flatMap((file) => file.localDependencies)).sort();
  const usedBy: string[] = [];
  for (const file of context.artifact.files) {
    if (definitionPaths.has(file.path)) {
      continue;
    }

    const usesSymbol =
      (await fileUsesSymbol(
        context.rootPath,
        file,
        input.componentName,
        'component',
        filesByPath,
        symbolResolutionCache,
        sourceCache,
      )) || (fileHasLegacyUsageOnly(file) && file.localDependencies.some((dependency) => definitionPaths.has(dependency)));

    if (usesSymbol) {
      usedBy.push(file.path);
    }
  }
  usedBy.sort();
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
      definitionCandidates: Array<{ file: string; line: number; kind: 'interface' | 'type' | 'enum' }>;
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
  const filesByPath = new Map(context.artifact.files.map((file) => [file.path, file] as const));
  const symbolResolutionCache = new Map<string, boolean>();
  const sourceCache = new Map<string, Promise<FileSourceAnalysis>>();
  const usedIn: string[] = [];
  for (const file of context.artifact.files) {
    if (definitionPaths.has(file.path)) {
      continue;
    }

    const usesType =
      (await fileUsesSymbol(
        context.rootPath,
        file,
        input.typeName,
        'type',
        filesByPath,
        symbolResolutionCache,
        sourceCache,
      )) || (fileHasLegacyUsageOnly(file) && file.localDependencies.some((dependency) => definitionPaths.has(dependency)));

    if (usesType) {
      usedIn.push(file.path);
    }
  }
  usedIn.sort();
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
