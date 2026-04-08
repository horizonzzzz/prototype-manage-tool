import fs from 'node:fs/promises';
import path from 'node:path';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { ensureChildPath, ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';

type CreateSourceSnapshotInput = {
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

const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);
const MAX_DIRECTORY_ENTRIES = 500;
const MAX_TEXT_FILE_BYTES = 256 * 1024;
const MAX_SEARCH_FILE_BYTES = 128 * 1024;
const MAX_SEARCH_RESULTS = 50;
const PUBLISHED_SNAPSHOT_MISSING_ERROR = 'Published source snapshot not found';

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown source snapshot error';
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

async function resolvePublishedSnapshotRoot(productKey: string, version: string) {
  const resolved = await resolvePublishedSnapshotVersion(productKey, { exact: version });
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
  const destinationDir = ensureVersionPathInsideRoot(appConfig.sourceSnapshotsDir, input.productKey, input.version);

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
        rootPath: destinationDir,
        fileCount,
        totalBytes,
        generatedAt,
        errorMessage: null,
      },
      update: {
        status: 'ready',
        rootPath: destinationDir,
        fileCount,
        totalBytes,
        generatedAt,
        errorMessage: null,
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
        rootPath: destinationDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: normalizeErrorMessage(error),
      },
      update: {
        status: 'failed',
        rootPath: destinationDir,
        fileCount: 0,
        totalBytes: 0,
        generatedAt: null,
        errorMessage: normalizeErrorMessage(error),
      },
    });
    throw error;
  }
}

export async function deleteSourceSnapshotForVersion(productKey: string, version: string) {
  const snapshotDir = ensureVersionPathInsideRoot(appConfig.sourceSnapshotsDir, productKey, version);
  await fse.remove(snapshotDir);
}

export async function deleteSourceSnapshotsForProduct(productKey: string) {
  const productSnapshotsDir = ensureChildPath(appConfig.sourceSnapshotsDir, productKey);
  await fse.remove(productSnapshotsDir);
}

export async function listPublishedSnapshotProducts() {
  const products = await prisma.product.findMany({
    where: {
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

export async function listPublishedSnapshotVersions(productKey: string) {
  const versions = await prisma.productVersion.findMany({
    where: {
      product: { key: productKey },
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

export async function resolvePublishedSnapshotVersion(productKey: string, selector: VersionSelector): Promise<PublishedSnapshotVersion> {
  const baseWhere = {
    product: { key: productKey },
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

  const safeRootPath = ensureVersionPathInsideRoot(appConfig.sourceSnapshotsDir, productKey, resolved.version);

  return {
    version: resolved.version,
    isDefault: resolved.isDefault,
    createdAt: resolved.createdAt.toISOString(),
    rootPath: safeRootPath,
  };
}

export async function getSourceTree(productKey: string, version: string, requestedPath?: string, depth = 1) {
  const rootPath = await resolvePublishedSnapshotRoot(productKey, version);
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

export async function readSourceFile(productKey: string, version: string, filePath: string, options?: ReadSourceFileOptions) {
  const rootPath = await resolvePublishedSnapshotRoot(productKey, version);
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

export async function searchSourceFiles(productKey: string, version: string, query: string) {
  const rootPath = await resolvePublishedSnapshotRoot(productKey, version);
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
