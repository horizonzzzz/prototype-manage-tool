import fs from 'node:fs/promises';
import path from 'node:path';

import {
  Project,
  ts,
  type CompilerOptions,
  type SourceFile,
  type TypeChecker,
} from 'ts-morph';

import { INDEXABLE_CODE_EXTENSIONS } from '@/lib/server/code-analysis';
import { getRelativeSourcePath } from '@/lib/server/source-index-semantic-symbols';

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);

const FALLBACK_COMPILER_OPTIONS: CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.Preserve,
  allowJs: true,
  checkJs: false,
  skipLibCheck: true,
  resolveJsonModule: true,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
};

export type SemanticProjectBootstrap = {
  project: Project;
  checker: TypeChecker;
  sourceFiles: SourceFile[];
  sourceFileEntries: Array<{
    relativePath: string;
    sourceFile: SourceFile;
  }>;
  configPath: string | null;
  warnings: string[];
};

function isAnalyzableCodePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return INDEXABLE_CODE_EXTENSIONS.has(extension);
}

async function collectAnalyzableSourceFiles(rootPath: string): Promise<string[]> {
  const collected: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (isAnalyzableCodePath(absolutePath)) {
        collected.push(absolutePath);
      }
    }
  }

  await walk(rootPath);
  return collected;
}

async function resolveConfigPath(rootPath: string) {
  for (const configName of ['tsconfig.json', 'jsconfig.json']) {
    const candidatePath = path.join(rootPath, configName);
    try {
      const stats = await fs.stat(candidatePath);
      if (stats.isFile()) {
        return candidatePath;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return null;
}

export async function createSemanticProject(rootPath: string): Promise<SemanticProjectBootstrap> {
  const warnings: string[] = [];
  const configPath = await resolveConfigPath(rootPath);

  let project: Project;
  if (configPath) {
    try {
      project = new Project({
        tsConfigFilePath: configPath,
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
      });
    } catch (error) {
      warnings.push(`Unable to load ${path.basename(configPath)}: ${(error as Error).message}`);
      project = new Project({
        compilerOptions: FALLBACK_COMPILER_OPTIONS,
        skipFileDependencyResolution: true,
      });
    }
  } else {
    project = new Project({
      compilerOptions: FALLBACK_COMPILER_OPTIONS,
      skipFileDependencyResolution: true,
    });
  }

  const analyzablePaths = await collectAnalyzableSourceFiles(rootPath);
  for (const filePath of analyzablePaths) {
    project.addSourceFileAtPathIfExists(filePath);
  }

  const sourceFileEntries = project
    .getSourceFiles()
    .map((sourceFile) => {
      const filePath = sourceFile.getFilePath();
      if (!isAnalyzableCodePath(filePath)) {
        return null;
      }

      const relativePath = getRelativeSourcePath(rootPath, filePath);
      if (!relativePath) {
        return null;
      }

      return {
        relativePath,
        sourceFile,
      };
    })
    .filter((entry): entry is { relativePath: string; sourceFile: SourceFile } => Boolean(entry))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    project,
    checker: project.getTypeChecker(),
    sourceFiles: sourceFileEntries.map((entry) => entry.sourceFile),
    sourceFileEntries,
    configPath,
    warnings,
  };
}
