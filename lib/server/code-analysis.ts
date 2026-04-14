import path from 'node:path';

import { dedupeStrings } from '@/lib/server/source-index-types';

export const INDEXABLE_SOURCE_EXTENSIONS = new Set([
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
export const INDEXABLE_CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export const LOCAL_IMPORT_RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

export type ImportResolutionConfig = {
  baseUrl: string | null;
  paths: Array<{
    pattern: string;
    targets: string[];
  }>;
  warnings: string[];
};

export function getLineNumberForOffset(source: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
    }
  }

  return line;
}

export function normalizePosixPath(value: string) {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  if (normalized === '.') {
    return normalized;
  }

  return normalized.replace(/^\.\/+/, '');
}

// --- JSONC ---

export function stripJsonComments(source: string) {
  let result = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '\n') {
        result += char;
        continue;
      }

      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

export function stripTrailingJsonCommas(source: string) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ',') {
      let lookahead = index + 1;
      while (lookahead < source.length && /\s/.test(source[lookahead])) {
        lookahead += 1;
      }

      if (source[lookahead] === '}' || source[lookahead] === ']') {
        continue;
      }
    }

    result += char;
  }

  return result;
}

export function parseJsonc<T>(source: string): T {
  const normalized = source.replace(/^\uFEFF/, '');
  return JSON.parse(stripTrailingJsonCommas(stripJsonComments(normalized))) as T;
}

// --- Import / Export parsing ---

export function parseImports(source: string) {
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

export function parseExports(source: string) {
  const exports: string[] = [];
  const declarationRegex =
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
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

// --- Symbol extraction ---

export function parseComponentCandidates(source: string, extension: string) {
  if (!['.tsx', '.jsx'].includes(extension)) {
    return [];
  }

  const components: Array<{ name: string; line: number }> = [];
  const functionRegex = /\b(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  const constRegex = /\b(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*(?::[\s\S]*?)?=\s*(?:async\s*)?(?:\(|<)/g;

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

export function parseTypeCandidates(source: string) {
  const types: Array<{ name: string; kind: 'interface' | 'type' | 'enum'; line: number }> = [];
  const patterns: Array<{ kind: 'interface' | 'type' | 'enum'; regex: RegExp }> = [
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

// --- Import resolution ---

export function resolveKnownImportPath(normalizedBase: string, knownFilePaths: Set<string>) {
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

export function matchesAliasPattern(pattern: string, importPath: string) {
  const wildcardIndex = pattern.indexOf('*');
  if (wildcardIndex < 0) {
    return importPath === pattern ? '' : null;
  }

  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);
  if (!importPath.startsWith(prefix) || !importPath.endsWith(suffix)) {
    return null;
  }

  return importPath.slice(prefix.length, importPath.length - suffix.length);
}

export async function loadImportResolutionConfig(rootPath: string): Promise<ImportResolutionConfig> {
  const warnings: string[] = [];
  const configCandidates = ['tsconfig.json', 'jsconfig.json'];
  let configName: string | null = null;
  let configContent: string | null = null;

  for (const candidate of configCandidates) {
    const candidatePath = path.join(rootPath, candidate);
    try {
      const fs = await import('node:fs/promises');
      configContent = await fs.default.readFile(candidatePath, 'utf8');
      configName = candidate;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        warnings.push(`Unable to read ${candidate}`);
      }
    }
  }

  if (!configName || configContent === null) {
    return {
      baseUrl: null,
      paths: [],
      warnings,
    };
  }

  try {
    const parsed = parseJsonc<{
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[] | string>;
      };
    }>(configContent);
    const compilerOptions = parsed.compilerOptions ?? {};
    const normalizedBaseUrl =
      typeof compilerOptions.baseUrl === 'string' && compilerOptions.baseUrl.trim()
        ? normalizePosixPath(compilerOptions.baseUrl.trim())
        : null;
    const rawPaths = compilerOptions.paths ?? {};
    const paths = Object.entries(rawPaths).flatMap(([pattern, targets]) => {
      const normalizedTargets = (Array.isArray(targets) ? targets : [targets])
        .filter((target): target is string => typeof target === 'string' && Boolean(target.trim()))
        .map((target) => normalizePosixPath(target.trim()));
      if (!pattern.trim() || normalizedTargets.length === 0) {
        return [];
      }

      return [
        {
          pattern: pattern.trim(),
          targets: normalizedTargets,
        },
      ];
    });

    return {
      baseUrl: normalizedBaseUrl,
      paths,
      warnings,
    };
  } catch {
    warnings.push(`Unable to parse ${configName}`);
    return {
      baseUrl: null,
      paths: [],
      warnings,
    };
  }
}

export function resolveLocalImportPath(
  fromPath: string,
  importPath: string,
  knownFilePaths: Set<string>,
  importResolutionConfig: ImportResolutionConfig,
) {
  if (importPath.startsWith('.')) {
    const baseDir = path.posix.dirname(fromPath);
    const normalizedBase = normalizePosixPath(path.posix.join(baseDir, importPath));
    return resolveKnownImportPath(normalizedBase, knownFilePaths);
  }

  for (const alias of importResolutionConfig.paths) {
    const wildcardValue = matchesAliasPattern(alias.pattern, importPath);
    if (wildcardValue === null) {
      continue;
    }

    for (const target of alias.targets) {
      const substitutedTarget = target.includes('*') ? target.replace('*', wildcardValue) : target;
      const basePath = importResolutionConfig.baseUrl
        ? normalizePosixPath(path.posix.join(importResolutionConfig.baseUrl, substitutedTarget))
        : normalizePosixPath(substitutedTarget);
      const resolved = resolveKnownImportPath(basePath, knownFilePaths);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (importResolutionConfig.baseUrl) {
    const resolved = resolveKnownImportPath(
      normalizePosixPath(path.posix.join(importResolutionConfig.baseUrl, importPath)),
      knownFilePaths,
    );
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

// --- Framework detection ---

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

export type SourceIndexFileEntryLite = {
  path: string;
  imports: string[];
};

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
