import fs from 'node:fs/promises';
import path from 'node:path';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { ensureChildPath, ensureUserVersionPathInsideRoot } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import type { McpAccessScope } from '@/lib/server/mcp-api-key-service';

type CreateSourceSnapshotInput = {
  userId: string;
  versionId: number;
  productKey: string;
  version: string;
  sourceDir: string;
};

type VersionSelector = 'default' | 'latest' | { exact: string };

type ReadSourceFileOptions = {
  startLine?: number;
  endLine?: number;
};

type PublishedSnapshotVersion = {
  version: string;
  isDefault: boolean;
  createdAt: string;
  rootPath: string;
};

type SourceIndexQueueState = {
  queue: number[];
  active: Set<number>;
  draining: boolean;
};

const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const MAX_DIRECTORY_ENTRIES = 500;
const MAX_TEXT_FILE_BYTES = 256 * 1024;
const MAX_SEARCH_FILE_BYTES = 128 * 1024;
const MAX_SEARCH_RESULTS = 50;
const PUBLISHED_SNAPSHOT_MISSING_ERROR = 'Published source snapshot not found';
const SOURCE_INDEX_ARTIFACT_KEY = 'source-tree-v1';
const MAX_INDEX_TEXT_FILE_BYTES = 512 * 1024;
const INDEXABLE_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.md',
]);
const INDEXABLE_CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const LOCAL_IMPORT_RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

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
    languages: Record<string, number>;
  };
  files: SourceIndexFileEntry[];
};

const globalQueueState = globalThis as typeof globalThis & {
  __sourceIndexQueueState__?: SourceIndexQueueState;
};

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown source snapshot error';
}

function getSourceIndexQueueState(): SourceIndexQueueState {
  if (!globalQueueState.__sourceIndexQueueState__) {
    globalQueueState.__sourceIndexQueueState__ = {
      queue: [],
      active: new Set<number>(),
      draining: false,
    };
  }

  return globalQueueState.__sourceIndexQueueState__;
}

async function collectDirectoryStats(rootPath: string): Promise<{ fileCount: number; totalBytes: number }> {
  let fileCount = 0;
  let totalBytes = 0;

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(entryPath);
      fileCount += 1;
      totalBytes += stats.size;
    }
  }

  await walk(rootPath);

  return { fileCount, totalBytes };
}

function normalizeSnapshotRelativePath(rawPath?: string) {
  const trimmed = (rawPath ?? '.').trim();
  if (!trimmed || trimmed === '.' || trimmed === '/') {
    return '.';
  }

  return trimmed.replace(/^[/\\]+/, '');
}

function toPosixRelativePath(rootPath: string, targetPath: string) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative) {
    return '.';
  }

  return relative.split(path.sep).join('/');
}

function isProbablyText(buffer: Buffer) {
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      return false;
    }
  }

  return true;
}

function getLineNumberForOffset(source: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

function parseImports(source: string) {
  const imports: string[] = [];
  const importRegex = /\bimport\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImportRegex = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const requireRegex = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const regex of [importRegex, dynamicImportRegex, requireRegex]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      imports.push(match[1]);
    }
  }

  return dedupeStrings(imports);
}

function parseExports(source: string) {
  const exports: string[] = [];
  const declarationRegex = /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  const namedRegex = /\bexport\s*{\s*([^}]+)\s*}/g;

  let declarationMatch: RegExpExecArray | null;
  while ((declarationMatch = declarationRegex.exec(source)) !== null) {
    exports.push(declarationMatch[1]);
  }

  let namedMatch: RegExpExecArray | null;
  while ((namedMatch = namedRegex.exec(source)) !== null) {
    const names = namedMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.split(/\s+as\s+/i)[1] ?? item.split(/\s+as\s+/i)[0]);
    exports.push(...names);
  }

  return dedupeStrings(exports);
}

function parseComponentCandidates(source: string, extension: string) {
  if (!['.tsx', '.jsx'].includes(extension)) {
    return [];
  }

  const components: IndexedComponentCandidate[] = [];
  const functionRegex = /\b(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  const constRegex = /\b(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\(|<)/g;

  for (const regex of [functionRegex, constRegex]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      components.push({
        name: match[1],
        line: getLineNumberForOffset(source, match.index),
      });
    }
  }

  return components;
}

function parseTypeCandidates(source: string) {
  const types: IndexedTypeCandidate[] = [];
  const patterns: Array<{ kind: IndexedTypeCandidate['kind']; regex: RegExp }> = [
    { kind: 'interface', regex: /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/g },
    { kind: 'type', regex: /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/g },
    { kind: 'enum', regex: /\b(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)\b/g },
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(source)) !== null) {
      types.push({
        name: match[1],
        kind: pattern.kind,
        line: getLineNumberForOffset(source, match.index),
      });
    }
  }

  return types;
}

function parseMockCandidates(relativePath: string, source: string) {
  const mocks: IndexedMockCandidate[] = [];
  const loweredPath = relativePath.toLowerCase();
  const pathSuggestsMock = /(^|\/)(?:__mocks__|mock|mocks|fixture|fixtures|stub|stubs|sample|samples)(\/|$)/.test(loweredPath);
  const symbolRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;

  let symbolMatch: RegExpExecArray | null;
  while ((symbolMatch = symbolRegex.exec(source)) !== null) {
    const symbolName = symbolMatch[1];
    const looksLikeMockName = /(mock|fixture|dummy|fake|stub|sample)/i.test(symbolName);
    if (!pathSuggestsMock && !looksLikeMockName) {
      continue;
    }

    mocks.push({
      name: symbolName,
      kind: 'const',
      line: getLineNumberForOffset(source, symbolMatch.index),
      reason: pathSuggestsMock ? 'path-pattern' : 'name-pattern',
    });
  }

  return mocks;
}

function resolveLocalImportPath(fromPath: string, importPath: string, knownFilePaths: Set<string>) {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const baseDir = path.posix.dirname(fromPath);
  const normalizedBase = path.posix.normalize(path.posix.join(baseDir, importPath));
  const candidates = [
    normalizedBase,
    ...LOCAL_IMPORT_RESOLVE_EXTENSIONS.map((extension) => `${normalizedBase}${extension}`),
    ...LOCAL_IMPORT_RESOLVE_EXTENSIONS.map((extension) => path.posix.join(normalizedBase, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (knownFilePaths.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectFrameworkHints(packageJson: string | null) {
  if (!packageJson) {
    return { hints: [] as string[], warnings: [] as string[] };
  }

  try {
    const parsed = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...parsed.dependencies,
      ...parsed.devDependencies,
      ...parsed.peerDependencies,
    };
    const names = Object.keys(dependencies);
    const hints = new Set<string>();
    for (const name of names) {
      if (name === 'next') hints.add('next');
      if (name === 'react' || name === 'react-dom') hints.add('react');
      if (name === 'react-router' || name === 'react-router-dom') hints.add('react-router');
      if (name === 'vite') hints.add('vite');
      if (name === 'vue') hints.add('vue');
      if (name === 'nuxt') hints.add('nuxt');
      if (name === 'svelte') hints.add('svelte');
      if (name === 'typescript') hints.add('typescript');
    }

    return { hints: [...hints], warnings: [] as string[] };
  } catch {
    return { hints: [] as string[], warnings: ['Unable to parse package.json'] };
  }
}

function detectRoutingMode(files: SourceIndexFileEntry[]) {
  const hasNextAppRouter = files.some((file) => /^app(?:\/.+)?\/page\.(?:tsx|ts|jsx|js)$/.test(file.path));
  if (hasNextAppRouter) {
    return 'next-app-router' as const;
  }

  const hasNextPagesRouter = files.some((file) => /^pages\/.+\.(?:tsx|ts|jsx|js)$/.test(file.path));
  if (hasNextPagesRouter) {
    return 'next-pages-router' as const;
  }

  const hasReactRouter = files.some((file) => file.imports.some((spec) => spec === 'react-router' || spec === 'react-router-dom'));
  if (hasReactRouter) {
    return 'react-router' as const;
  }

  const appFile = files.find((file) => /(?:^|\/)App\.(?:tsx|jsx)$/.test(file.path));
  if (appFile && /App\.(?:tsx|jsx)$/.test(appFile.path)) {
    return 'app-tsx-state' as const;
  }

  return 'unknown' as const;
}

async function buildSourceIndexArtifact(rootPath: string, snapshotVersionId: number): Promise<SourceIndexArtifact> {
  const files: SourceIndexFileEntry[] = [];
  const warnings: string[] = [];
  const languageCounts = new Map<string, number>();
  let packageJsonContent: string | null = null;
  let totalBytes = 0;

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = toPosixRelativePath(rootPath, absolutePath);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      totalBytes += stats.size;

      const extension = path.extname(relativePath).toLowerCase();
      languageCounts.set(extension || '<none>', (languageCounts.get(extension || '<none>') ?? 0) + 1);

      if (relativePath === 'package.json' && stats.size <= MAX_INDEX_TEXT_FILE_BYTES) {
        packageJsonContent = await fs.readFile(absolutePath, 'utf8');
      }

      const entryRecord: SourceIndexFileEntry = {
        path: relativePath,
        size: stats.size,
        ext: extension,
        imports: [],
        exports: [],
        localDependencies: [],
        symbols: {
          components: [],
          types: [],
          mocks: [],
        },
      };

      if (!INDEXABLE_SOURCE_EXTENSIONS.has(extension) || stats.size > MAX_INDEX_TEXT_FILE_BYTES) {
        files.push(entryRecord);
        continue;
      }

      const content = await fs.readFile(absolutePath);
      if (!isProbablyText(content)) {
        files.push(entryRecord);
        continue;
      }

      const source = content.toString('utf8');
      entryRecord.imports = parseImports(source);
      entryRecord.exports = parseExports(source);
      if (INDEXABLE_CODE_EXTENSIONS.has(extension)) {
        entryRecord.symbols.components = parseComponentCandidates(source, extension);
        entryRecord.symbols.types = parseTypeCandidates(source);
      }
      entryRecord.symbols.mocks = parseMockCandidates(relativePath, source);

      files.push(entryRecord);
    }
  }

  await walk(rootPath);

  const knownFilePaths = new Set(files.map((file) => file.path));
  for (const file of files) {
    const dependencies = file.imports
      .map((item) => resolveLocalImportPath(file.path, item, knownFilePaths))
      .filter((item): item is string => Boolean(item));
    file.localDependencies = dedupeStrings(dependencies);
  }

  const frameworkDetection = detectFrameworkHints(packageJsonContent);
  warnings.push(...frameworkDetection.warnings);
  const routingMode = detectRoutingMode(files);
  if (routingMode === 'unknown') {
    warnings.push('Routing mode is unknown');
  }

  return {
    format: SOURCE_INDEX_ARTIFACT_KEY,
    snapshotVersionId,
    generatedAt: new Date().toISOString(),
    summary: {
      fileCount: files.length,
      totalBytes,
      frameworkHints: frameworkDetection.hints,
      routingMode,
      warnings: dedupeStrings(warnings),
      languages: Object.fromEntries([...languageCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    },
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

async function resolvePublishedSnapshotRoot(scope: McpAccessScope, productKey: string, version: string) {
  const resolved = await resolvePublishedSnapshotVersion(scope, productKey, { exact: version });
  return resolved.rootPath;
}

function clampLine(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function isPathInsideRoot(rootDir: string, candidatePath: string) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidatePath));
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function createSourceSnapshot(input: CreateSourceSnapshotInput) {
  const destinationDir = ensureUserVersionPathInsideRoot(
    appConfig.sourceSnapshotsDir,
    input.userId,
    input.productKey,
    input.version,
  );

  try {
    await fse.remove(destinationDir);
    await fse.ensureDir(path.dirname(destinationDir));
    await fse.copy(input.sourceDir, destinationDir, {
      overwrite: true,
      filter: (sourcePath) => {
        const baseName = path.basename(sourcePath);
        if (!EXCLUDED_DIRECTORIES.has(baseName)) {
          return true;
        }

        const stats = fse.statSync(sourcePath);
        return !stats.isDirectory();
      },
    });

    const { fileCount, totalBytes } = await collectDirectoryStats(destinationDir);
    const generatedAt = new Date();

    await prisma.sourceSnapshot.upsert({
      where: { versionId: input.versionId },
      create: {
        versionId: input.versionId,
        status: 'ready',
        indexStatus: 'pending',
        rootPath: destinationDir,
        fileCount,
        totalBytes,
        generatedAt,
        errorMessage: null,
        indexGeneratedAt: null,
        indexErrorMessage: null,
      },
      update: {
        status: 'ready',
        indexStatus: 'pending',
        rootPath: destinationDir,
        fileCount,
        totalBytes,
        generatedAt,
        errorMessage: null,
        indexGeneratedAt: null,
        indexErrorMessage: null,
      },
    });

    return {
      rootPath: destinationDir,
      fileCount,
      totalBytes,
    };
  } catch (error) {
    await fse.remove(destinationDir);
    await prisma.sourceSnapshot.upsert({
      where: { versionId: input.versionId },
      create: {
        versionId: input.versionId,
        status: 'failed',
        indexStatus: 'failed',
        rootPath: destinationDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: normalizeErrorMessage(error),
        indexGeneratedAt: null,
        indexErrorMessage: normalizeErrorMessage(error),
      },
      update: {
        status: 'failed',
        indexStatus: 'failed',
        rootPath: destinationDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: normalizeErrorMessage(error),
        indexGeneratedAt: null,
        indexErrorMessage: normalizeErrorMessage(error),
      },
    });
    throw error;
  }
}

export async function rebuildSourceSnapshotIndex(versionId: number) {
  const snapshot = await prisma.sourceSnapshot.findUnique({
    where: { versionId },
    select: {
      id: true,
      status: true,
      rootPath: true,
    },
  });

  if (!snapshot || snapshot.status !== 'ready') {
    throw new Error('Ready source snapshot not found');
  }

  try {
    await prisma.sourceSnapshot.update({
      where: { id: snapshot.id },
      data: {
        indexStatus: 'indexing',
        indexGeneratedAt: null,
        indexErrorMessage: null,
      },
    });

    const indexArtifact = await buildSourceIndexArtifact(snapshot.rootPath, versionId);
    const generatedAt = new Date(indexArtifact.generatedAt);

    await prisma.$transaction(async (transaction) => {
      await transaction.sourceIndexArtifact.deleteMany({
        where: {
          snapshotId: snapshot.id,
          artifactKey: SOURCE_INDEX_ARTIFACT_KEY,
        },
      });

      await transaction.sourceIndexArtifact.create({
        data: {
          snapshotId: snapshot.id,
          artifactKey: SOURCE_INDEX_ARTIFACT_KEY,
          contentJson: JSON.stringify(indexArtifact),
          status: 'ready',
          generatedAt,
          errorMessage: null,
        },
      });

      await transaction.sourceSnapshot.update({
        where: { id: snapshot.id },
        data: {
          indexStatus: 'ready',
          indexGeneratedAt: generatedAt,
          indexErrorMessage: null,
        },
      });
    });
  } catch (error) {
    await prisma.sourceSnapshot.updateMany({
      where: { versionId },
      data: {
        indexStatus: 'failed',
        indexGeneratedAt: null,
        indexErrorMessage: normalizeErrorMessage(error),
      },
    });
    throw error;
  }
}

async function drainSourceIndexQueue() {
  const state = getSourceIndexQueueState();
  if (state.draining) {
    return;
  }

  state.draining = true;
  try {
    while (state.queue.length > 0) {
      const versionId = state.queue.shift();
      if (!versionId || state.active.has(versionId)) {
        continue;
      }

      state.active.add(versionId);
      try {
        await rebuildSourceSnapshotIndex(versionId);
      } catch {
        // Failures are persisted by rebuildSourceSnapshotIndex and retried by backfill.
      } finally {
        state.active.delete(versionId);
      }
    }
  } finally {
    state.draining = false;
  }
}

export function scheduleSourceSnapshotIndexBuild(versionId: number) {
  const state = getSourceIndexQueueState();
  if (state.active.has(versionId) || state.queue.includes(versionId)) {
    return;
  }

  state.queue.push(versionId);
  setTimeout(() => {
    void drainSourceIndexQueue();
  }, 0);
}

export async function deleteSourceIndexForVersion(userId: string, productKey: string, version: string) {
  await prisma.sourceIndexArtifact.deleteMany({
    where: {
      snapshot: {
        version: {
          version,
          product: {
            key: productKey,
            ownerId: userId,
          },
        },
      },
    },
  });
}

export async function deleteSourceIndexesForProduct(userId: string, productKey: string) {
  await prisma.sourceIndexArtifact.deleteMany({
    where: {
      snapshot: {
        version: {
          product: {
            key: productKey,
            ownerId: userId,
          },
        },
      },
    },
  });
}

export async function deleteSourceSnapshotForVersion(userId: string, productKey: string, version: string) {
  const snapshotDir = ensureUserVersionPathInsideRoot(appConfig.sourceSnapshotsDir, userId, productKey, version);
  await fse.remove(snapshotDir);
}

export async function deleteSourceSnapshotsForProduct(userId: string, productKey: string) {
  const productSnapshotsDir = ensureChildPath(appConfig.sourceSnapshotsDir, userId, productKey);
  await fse.remove(productSnapshotsDir);
}

export async function listPublishedSnapshotProducts(scope: McpAccessScope) {
  if (!scope.allowedProductIds.length) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      id: {
        in: scope.allowedProductIds,
      },
      ownerId: scope.userId,
      versions: {
        some: {
          status: 'published',
          sourceSnapshot: {
            is: {
              status: 'ready',
            },
          },
        },
      },
    },
    select: {
      key: true,
      name: true,
      description: true,
      versions: {
        where: {
          status: 'published',
          sourceSnapshot: {
            is: {
              status: 'ready',
            },
          },
        },
        select: {
          version: true,
          isDefault: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return products
    .filter((product) => product.versions.length > 0)
    .map((product) => ({
      productKey: product.key,
      name: product.name,
      description: product.description,
      publishedVersionCount: product.versions.length,
      defaultVersion: product.versions.find((version) => version.isDefault)?.version ?? product.versions[0]?.version ?? null,
    }));
}

export async function listPublishedSnapshotVersions(scope: McpAccessScope, productKey: string) {
  if (!scope.allowedProductIds.length) {
    return [];
  }

  const versions = await prisma.productVersion.findMany({
    where: {
      product: {
        key: productKey,
        ownerId: scope.userId,
        id: {
          in: scope.allowedProductIds,
        },
      },
      status: 'published',
      sourceSnapshot: {
        is: {
          status: 'ready',
        },
      },
    },
    select: {
      version: true,
      status: true,
      isDefault: true,
      entryUrl: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return versions.map((item) => ({
    version: item.version,
    status: item.status,
    isDefault: item.isDefault,
    previewEntryUrl: item.entryUrl,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function resolvePublishedSnapshotVersion(
  scope: McpAccessScope,
  productKey: string,
  selector: VersionSelector,
): Promise<PublishedSnapshotVersion> {
  if (!scope.allowedProductIds.length) {
    throw new Error(PUBLISHED_SNAPSHOT_MISSING_ERROR);
  }

  const baseWhere = {
    product: {
      key: productKey,
      ownerId: scope.userId,
      id: {
        in: scope.allowedProductIds,
      },
    },
    status: 'published',
    sourceSnapshot: {
      is: {
        status: 'ready',
      },
    },
  };

  const select = {
    version: true,
    isDefault: true,
    createdAt: true,
    sourceSnapshot: {
      select: {
        rootPath: true,
        status: true,
      },
    },
  } as const;

  const resolved =
    selector === 'default'
      ? await prisma.productVersion.findFirst({
          where: { ...baseWhere, isDefault: true },
          orderBy: { createdAt: 'desc' },
          select,
        })
      : selector === 'latest'
        ? await prisma.productVersion.findFirst({
            where: baseWhere,
            orderBy: { createdAt: 'desc' },
            select,
          })
        : await prisma.productVersion.findFirst({
            where: { ...baseWhere, version: selector.exact },
            select,
          });

  if (!resolved?.sourceSnapshot || resolved.sourceSnapshot.status !== 'ready') {
    throw new Error(PUBLISHED_SNAPSHOT_MISSING_ERROR);
  }

  if (!isPathInsideRoot(appConfig.sourceSnapshotsDir, resolved.sourceSnapshot.rootPath)) {
    throw new Error(PUBLISHED_SNAPSHOT_MISSING_ERROR);
  }

  const safeRootPath = ensureUserVersionPathInsideRoot(appConfig.sourceSnapshotsDir, scope.userId, productKey, resolved.version);
  if (path.resolve(resolved.sourceSnapshot.rootPath) !== path.resolve(safeRootPath)) {
    throw new Error(PUBLISHED_SNAPSHOT_MISSING_ERROR);
  }

  return {
    version: resolved.version,
    isDefault: resolved.isDefault,
    createdAt: resolved.createdAt.toISOString(),
    rootPath: safeRootPath,
  };
}

export async function getSourceTree(scope: McpAccessScope, productKey: string, version: string, requestedPath?: string, depth = 1) {
  const rootPath = await resolvePublishedSnapshotRoot(scope, productKey, version);
  const normalizedPath = normalizeSnapshotRelativePath(requestedPath);
  const targetPath = normalizedPath === '.' ? rootPath : ensureChildPath(rootPath, normalizedPath);
  const stats = await fs.stat(targetPath);
  const maxDepth = Math.max(0, Math.trunc(depth));

  async function readNode(absolutePath: string, remainingDepth: number): Promise<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    entries?: Array<{
      name: string;
      path: string;
      type: 'file' | 'directory';
      size?: number;
      entries?: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
      }>;
      truncated?: boolean;
    }>;
    truncated?: boolean;
  }> {
    const nodeStats = await fs.stat(absolutePath);
    const relativePath = toPosixRelativePath(rootPath, absolutePath);

    if (!nodeStats.isDirectory()) {
      return {
        name: path.basename(absolutePath),
        path: relativePath,
        type: 'file',
        size: nodeStats.size,
      };
    }

    if (remainingDepth <= 0) {
      return {
        name: relativePath === '.' ? '.' : path.basename(absolutePath),
        path: relativePath,
        type: 'directory',
        entries: [],
        truncated: false,
      };
    }

    const dirEntries = await fs.readdir(absolutePath, { withFileTypes: true });
    const sortedEntries = [...dirEntries].sort((left, right) => left.name.localeCompare(right.name));
    const limitedEntries = sortedEntries.slice(0, MAX_DIRECTORY_ENTRIES);
    const entries = await Promise.all(
      limitedEntries.map(async (entry) => {
        const childPath = path.join(absolutePath, entry.name);
        const childStats = await fs.stat(childPath);
        if (childStats.isDirectory() && remainingDepth > 1) {
          return await readNode(childPath, remainingDepth - 1);
        }

        return {
          name: entry.name,
          path: toPosixRelativePath(rootPath, childPath),
          type: childStats.isDirectory() ? ('directory' as const) : ('file' as const),
          size: childStats.isFile() ? childStats.size : undefined,
        };
      }),
    );

    return {
      name: relativePath === '.' ? '.' : path.basename(absolutePath),
      path: relativePath,
      type: 'directory',
      entries,
      truncated: sortedEntries.length > MAX_DIRECTORY_ENTRIES,
    };
  }

  return {
    path: normalizedPath === '.' ? '.' : toPosixRelativePath(rootPath, targetPath),
    type: stats.isDirectory() ? ('directory' as const) : ('file' as const),
    depth: maxDepth,
    tree: await readNode(targetPath, maxDepth),
  };
}

export async function readSourceFile(
  scope: McpAccessScope,
  productKey: string,
  version: string,
  filePath: string,
  options?: ReadSourceFileOptions,
) {
  const rootPath = await resolvePublishedSnapshotRoot(scope, productKey, version);
  const normalizedPath = normalizeSnapshotRelativePath(filePath);
  const absolutePath = normalizedPath === '.' ? rootPath : ensureChildPath(rootPath, normalizedPath);
  const stats = await fs.stat(absolutePath);

  if (!stats.isFile()) {
    throw new Error('Path is not a file');
  }

  const buffer = await fs.readFile(absolutePath);

  if (!isProbablyText(buffer)) {
    throw new Error('Only text files can be read');
  }

  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;
  const requestedStart = options?.startLine ?? 1;
  const requestedEnd = options?.endLine ?? totalLines;
  const startLine = clampLine(requestedStart, 1, Math.max(1, totalLines));
  const endLine = clampLine(requestedEnd, startLine, Math.max(startLine, totalLines));
  const selectedLines = lines.slice(startLine - 1, endLine);

  return {
    path: toPosixRelativePath(rootPath, absolutePath),
    content: selectedLines.join('\n'),
    startLine,
    endLine,
    totalLines,
    truncated: startLine > 1 || endLine < totalLines,
  };
}

export async function searchSourceFiles(scope: McpAccessScope, productKey: string, version: string, query: string) {
  const rootPath = await resolvePublishedSnapshotRoot(scope, productKey, version);
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { query, results: [] as Array<{ path: string; matchCount: number }>, truncated: false };
  }

  const loweredQuery = normalizedQuery.toLowerCase();
  const results: Array<{ path: string; matchCount: number }> = [];

  async function walk(currentPath: string): Promise<void> {
    if (results.length >= MAX_SEARCH_RESULTS) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= MAX_SEARCH_RESULTS) {
        return;
      }

      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(entryPath);
      if (stats.size > MAX_SEARCH_FILE_BYTES) {
        continue;
      }

      const content = await fs.readFile(entryPath);
      if (!isProbablyText(content)) {
        continue;
      }

      const lines = content.toString('utf8').split(/\r?\n/);
      let matchCount = 0;
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].toLowerCase().includes(loweredQuery)) {
          matchCount += 1;
        }
      }

      if (!matchCount) {
        continue;
      }

      results.push({
        path: toPosixRelativePath(rootPath, entryPath),
        matchCount,
      });

      if (results.length >= MAX_SEARCH_RESULTS) {
        return;
      }
    }
  }

  await walk(rootPath);

  return {
    query,
    results,
    truncated: results.length >= MAX_SEARCH_RESULTS,
  };
}
