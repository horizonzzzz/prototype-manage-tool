import path from 'node:path';

import { Node, SyntaxKind, ts, type CallExpression, type Identifier, type SourceFile, type Symbol as MorphSymbol, type VariableDeclaration } from 'ts-morph';

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

export type SemanticModuleReference = {
  kind: 'dynamic-import' | 'require';
  specifier: string;
  resolvedPath: string | null;
  line: number;
  accessedExports: string[];
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

function resolveModuleSpecifierRelativePath(
  sourceFile: SourceFile,
  specifier: string,
  relativePathByAbsolute: Map<string, string>,
) {
  const resolvedModule = ts.resolveModuleName(
    specifier,
    sourceFile.getFilePath(),
    sourceFile.getProject().getCompilerOptions(),
    ts.sys,
  ).resolvedModule;
  if (resolvedModule) {
    const resolvedPath = relativePathByAbsolute.get(path.normalize(resolvedModule.resolvedFileName));
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  const sourceRelativePath = relativePathByAbsolute.get(sourceFile.getFilePath());
  if (!sourceRelativePath || !specifier.startsWith('.')) {
    return null;
  }

  const basePath = normalizePosixPath(path.posix.join(path.posix.dirname(sourceRelativePath), specifier));
  const knownPaths = new Set(relativePathByAbsolute.values());
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.json`,
    path.posix.join(basePath, 'index.ts'),
    path.posix.join(basePath, 'index.tsx'),
    path.posix.join(basePath, 'index.js'),
    path.posix.join(basePath, 'index.jsx'),
    path.posix.join(basePath, 'index.mjs'),
    path.posix.join(basePath, 'index.cjs'),
    path.posix.join(basePath, 'index.json'),
  ];

  return candidates.find((candidate) => knownPaths.has(candidate)) ?? null;
}

function getLiteralModuleSpecifier(callExpression: CallExpression) {
  const argument = callExpression.getArguments()[0];
  if (!argument) {
    return null;
  }

  if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
    return argument.getLiteralText();
  }

  return null;
}

function getModuleReferenceKind(callExpression: CallExpression): SemanticModuleReference['kind'] | null {
  const expression = callExpression.getExpression();
  if (expression.getKind() === SyntaxKind.ImportKeyword) {
    return 'dynamic-import';
  }

  if (Node.isIdentifier(expression) && expression.getText() === 'require') {
    return 'require';
  }

  return null;
}

function isSameSymbol(left: MorphSymbol | undefined, right: MorphSymbol | undefined) {
  const leftDeclaration = left?.getDeclarations().at(0);
  const rightDeclaration = right?.getDeclarations().at(0);
  return Boolean(leftDeclaration && rightDeclaration && leftDeclaration === rightDeclaration);
}

function collectObjectBindingExportNames(bindingPattern: Node) {
  if (!Node.isObjectBindingPattern(bindingPattern)) {
    return [];
  }

  return bindingPattern
    .getElements()
    .map((element) => element.getPropertyNameNode()?.getText() ?? element.getNameNode().getText())
    .filter((name) => name.length > 0);
}

function collectPropertyAccessedExports(container: Node, bindingIdentifier: Identifier, sourceFile: SourceFile) {
  const checker = sourceFile.getProject().getTypeChecker();
  const bindingSymbol = checker.getSymbolAtLocation(bindingIdentifier);
  const exportNames: string[] = [];

  for (const propertyAccess of container.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const expression = propertyAccess.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== bindingIdentifier.getText()) {
      continue;
    }

    if (!isSameSymbol(checker.getSymbolAtLocation(expression), bindingSymbol)) {
      continue;
    }

    exportNames.push(propertyAccess.getNameNode().getText());
  }

  return exportNames;
}

function collectVariableBindingAccessedExports(variableDeclaration: VariableDeclaration, sourceFile: SourceFile) {
  const nameNode = variableDeclaration.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    return collectObjectBindingExportNames(nameNode);
  }

  if (Node.isIdentifier(nameNode)) {
    return collectPropertyAccessedExports(sourceFile, nameNode, sourceFile);
  }

  return [];
}

function getCallExpressionVariableDeclaration(callExpression: CallExpression) {
  const parent = callExpression.getParent();
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === callExpression) {
    return parent;
  }

  if (Node.isAwaitExpression(parent)) {
    const declaration = parent.getParentIfKind(SyntaxKind.VariableDeclaration);
    if (declaration?.getInitializer() === parent) {
      return declaration;
    }
  }

  return null;
}

function collectThenCallbackAccessedExports(thenCall: CallExpression, sourceFile: SourceFile) {
  const callback = thenCall.getArguments()[0];
  if (!callback || !(Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))) {
    return [];
  }

  const parameter = callback.getParameters()[0];
  const nameNode = parameter?.getNameNode();
  if (!nameNode) {
    return [];
  }

  if (Node.isObjectBindingPattern(nameNode)) {
    return collectObjectBindingExportNames(nameNode);
  }

  if (Node.isIdentifier(nameNode)) {
    return collectPropertyAccessedExports(callback, nameNode, sourceFile);
  }

  return [];
}

function collectDynamicImportAccessedExports(callExpression: CallExpression, sourceFile: SourceFile) {
  const parent = callExpression.getParent();
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === callExpression) {
    if (parent.getNameNode().getText() !== 'then') {
      return [parent.getNameNode().getText()];
    }

    const thenCall = parent.getParentIfKind(SyntaxKind.CallExpression);
    if (thenCall) {
      return collectThenCallbackAccessedExports(thenCall, sourceFile);
    }
  }

  const variableDeclaration = getCallExpressionVariableDeclaration(callExpression);
  if (variableDeclaration) {
    return collectVariableBindingAccessedExports(variableDeclaration, sourceFile);
  }

  return [];
}

function collectRequireAccessedExports(callExpression: CallExpression, sourceFile: SourceFile) {
  const parent = callExpression.getParent();
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === callExpression) {
    return [parent.getNameNode().getText()];
  }

  const variableDeclaration = getCallExpressionVariableDeclaration(callExpression);
  if (variableDeclaration) {
    return collectVariableBindingAccessedExports(variableDeclaration, sourceFile);
  }

  return [];
}

function collectModuleReferenceAccessedExports(
  callExpression: CallExpression,
  kind: SemanticModuleReference['kind'],
  sourceFile: SourceFile,
) {
  const exportNames =
    kind === 'dynamic-import'
      ? collectDynamicImportAccessedExports(callExpression, sourceFile)
      : collectRequireAccessedExports(callExpression, sourceFile);

  return dedupeStrings(exportNames);
}

export function collectSemanticModuleReferences(
  sourceFile: SourceFile,
  relativePathByAbsolute: Map<string, string>,
): SemanticModuleReference[] {
  const references: SemanticModuleReference[] = [];

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const kind = getModuleReferenceKind(callExpression);
    if (!kind) {
      continue;
    }

    const specifier = getLiteralModuleSpecifier(callExpression);
    if (!specifier) {
      continue;
    }

    references.push({
      kind,
      specifier,
      resolvedPath: resolveModuleSpecifierRelativePath(sourceFile, specifier, relativePathByAbsolute),
      line: sourceFile.getLineAndColumnAtPos(callExpression.getStart()).line,
      accessedExports: collectModuleReferenceAccessedExports(callExpression, kind, sourceFile),
    });
  }

  return references;
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

      for (const reference of collectSemanticModuleReferences(entry.sourceFile, relativePathByAbsolute)) {
        imports.push(reference.specifier);
        if (reference.resolvedPath) {
          localDependencies.push(reference.resolvedPath);
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
