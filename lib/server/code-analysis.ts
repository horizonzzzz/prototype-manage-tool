import path from 'node:path';

import type { SourceFile } from 'ts-morph';

import { dedupeStrings } from '@/lib/server/source-index-types';

export const INDEXABLE_CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export type SourceIndexFileEntryLite = {
  path: string;
  imports: string[];
};

type SemanticSourceFileEntry = {
  relativePath: string;
  sourceFile: SourceFile;
};

export function normalizePosixPath(value: string) {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '.') {
    return normalized;
  }

  return normalized.replace(/^\.\/+/, '');
}

function resolveModuleRelativePath(
  sourceFile: SourceFile | undefined,
  relativePathByAbsolute: Map<string, string>,
) {
  if (!sourceFile) {
    return null;
  }

  return relativePathByAbsolute.get(sourceFile.getFilePath()) ?? null;
}

export function collectSemanticFileMetadata(sourceFileEntries: SemanticSourceFileEntry[]) {
  const relativePathByAbsolute = new Map(
    sourceFileEntries.map((entry) => [entry.sourceFile.getFilePath(), entry.relativePath] as const),
  );

  return new Map(
    sourceFileEntries.map((entry) => {
      const imports: string[] = [];
      const localDependencies: string[] = [];

      for (const importDeclaration of entry.sourceFile.getImportDeclarations()) {
        imports.push(importDeclaration.getModuleSpecifierValue());
        const resolvedPath = resolveModuleRelativePath(
          importDeclaration.getModuleSpecifierSourceFile(),
          relativePathByAbsolute,
        );
        if (resolvedPath) {
          localDependencies.push(resolvedPath);
        }
      }

      for (const exportDeclaration of entry.sourceFile.getExportDeclarations()) {
        const moduleSpecifier = exportDeclaration.getModuleSpecifierValue();
        if (!moduleSpecifier) {
          continue;
        }

        imports.push(moduleSpecifier);
        const resolvedPath = resolveModuleRelativePath(
          exportDeclaration.getModuleSpecifierSourceFile(),
          relativePathByAbsolute,
        );
        if (resolvedPath) {
          localDependencies.push(resolvedPath);
        }
      }

      return [
        entry.relativePath,
        {
          imports: dedupeStrings(imports),
          localDependencies: dedupeStrings(localDependencies),
        },
      ] as const;
    }),
  );
}

export function detectFrameworkHints(packageJson: string | null) {
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

export function detectRoutingMode(files: SourceIndexFileEntryLite[]) {
  const hasNextAppRouter = files.some((file) => /^app(?:\/.+)?\/page\.(?:tsx|ts|jsx|js)$/.test(file.path));
  if (hasNextAppRouter) {
    return 'next-app-router' as const;
  }

  const hasNextPagesRouter = files.some((file) => /^pages\/.+\.(?:tsx|ts|jsx|js)$/.test(file.path));
  if (hasNextPagesRouter) {
    return 'next-pages-router' as const;
  }

  const hasReactRouter = files.some(
    (file) => file.imports.some((spec) => spec === 'react-router' || spec === 'react-router-dom'),
  );
  if (hasReactRouter) {
    return 'react-router' as const;
  }

  const appFile = files.find((file) => /(?:^|\/)App\.(?:tsx|jsx)$/.test(file.path));
  if (appFile && /App\.(?:tsx|jsx)$/.test(appFile.path)) {
    return 'app-tsx-state' as const;
  }

  return 'unknown' as const;
}
