import fs from 'node:fs/promises';
import path from 'node:path';

import {
  detectFrameworkHints,
  detectRoutingMode,
  INDEXABLE_CODE_EXTENSIONS,
  INDEXABLE_SOURCE_EXTENSIONS,
  loadImportResolutionConfig,
  parseComponentCandidates,
  parseExports,
  parseImportEntries,
  parseImports,
  parseReExportEntries,
  parseTypeCandidates,
  resolveLocalImportPath,
} from '@/lib/server/code-analysis';
import { prisma } from '@/lib/prisma';
import {
  dedupeStrings,
  isProbablyText,
  SOURCE_INDEX_ARTIFACT_KEY,
  type SourceIndexArtifact,
  type SourceIndexFileEntry,
} from '@/lib/server/source-index-types';

const MAX_INDEX_TEXT_FILE_BYTES = 512 * 1024;

function toPosixRelativePath(rootPath: string, targetPath: string) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative) {
    return '.';
  }

  return relative.split(path.sep).join('/');
}

async function buildSourceIndexArtifact(rootPath: string, snapshotVersionId: number): Promise<SourceIndexArtifact> {
  const files: SourceIndexFileEntry[] = [];
  const warnings: string[] = [];
  const languageCounts = new Map<string, number>();
  let packageJsonContent: string | null = null;
  let totalBytes = 0;
  const importResolutionConfig = await loadImportResolutionConfig(rootPath);
  warnings.push(...importResolutionConfig.warnings);

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = toPosixRelativePath(rootPath, absolutePath);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') {
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
        importEntries: [],
        reExportEntries: [],
        symbols: {
          components: [],
          types: [],
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
      entryRecord.importEntries = parseImportEntries(source);
      entryRecord.reExportEntries = parseReExportEntries(source);
      if (INDEXABLE_CODE_EXTENSIONS.has(extension)) {
        entryRecord.symbols.components = parseComponentCandidates(source, extension);
        entryRecord.symbols.types = parseTypeCandidates(source);
      }

      files.push(entryRecord);
    }
  }

  await walk(rootPath);

  const knownFilePaths = new Set(files.map((file) => file.path));
  for (const file of files) {
    file.importEntries = file.importEntries.map((entry) => ({
      ...entry,
      resolvedPath: resolveLocalImportPath(file.path, entry.source, knownFilePaths, importResolutionConfig),
    }));
    file.reExportEntries = file.reExportEntries.map((entry) => ({
      ...entry,
      resolvedPath: resolveLocalImportPath(file.path, entry.source, knownFilePaths, importResolutionConfig),
    }));

    const dependencies = [...file.importEntries.map((entry) => entry.resolvedPath), ...file.reExportEntries.map((entry) => entry.resolvedPath)]
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

export async function persistSourceIndexArtifact(snapshotId: number, artifact: SourceIndexArtifact) {
  const generatedAt = new Date(artifact.generatedAt);

  await prisma.$transaction(async (transaction) => {
    await transaction.sourceIndexArtifact.deleteMany({
      where: {
        snapshotId,
        artifactKey: SOURCE_INDEX_ARTIFACT_KEY,
      },
    });

    await transaction.sourceIndexArtifact.create({
      data: {
        snapshotId,
        artifactKey: SOURCE_INDEX_ARTIFACT_KEY,
        contentJson: JSON.stringify(artifact),
        status: 'ready',
        generatedAt,
        errorMessage: null,
      },
    });

    await transaction.sourceSnapshot.update({
      where: { id: snapshotId },
      data: {
        indexStatus: 'ready',
        indexGeneratedAt: generatedAt,
        indexErrorMessage: null,
      },
    });
  });
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

    const artifact = await buildSourceIndexArtifact(snapshot.rootPath, versionId);
    await persistSourceIndexArtifact(snapshot.id, artifact);
  } catch (error) {
    await prisma.sourceSnapshot.updateMany({
      where: { versionId },
      data: {
        indexStatus: 'failed',
        indexGeneratedAt: null,
        indexErrorMessage: error instanceof Error ? error.message : 'Unknown source snapshot error',
      },
    });
    throw error;
  }
}

export { buildSourceIndexArtifact };
