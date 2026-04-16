import { Node, SyntaxKind, type SourceFile, type Symbol as MorphSymbol } from 'ts-morph';

import { collectSemanticModuleReferences } from '@/lib/server/code-analysis';
import type { SemanticProjectBootstrap } from '@/lib/server/source-index-semantic-project';
import { getNodeLine, unwrapAliasedSymbol } from '@/lib/server/source-index-semantic-symbols';
import type { SourceIndexDefinition, SourceIndexUsage } from '@/lib/server/source-index-types';

type ImportBindingInfo = {
  kind: 'default' | 'named' | 'namespace';
  exportName: string | null;
  localName: string;
  resolvedPath: string | null;
  isTypeOnly: boolean;
};

type DefinitionLookups = {
  byExportSite: Map<string, SourceIndexDefinition[]>;
  byDeclarationSite: Map<string, SourceIndexDefinition[]>;
  byExporterFile: Map<string, SourceIndexDefinition[]>;
};

function createExportSiteKey(filePath: string, exportName: string) {
  return `${filePath}::${exportName}`;
}

function createDeclarationSiteKey(filePath: string, line: number) {
  return `${filePath}:${line}`;
}

function buildDefinitionLookups(definitions: SourceIndexDefinition[]): DefinitionLookups {
  const byExportSite = new Map<string, SourceIndexDefinition[]>();
  const byDeclarationSite = new Map<string, SourceIndexDefinition[]>();
  const byExporterFile = new Map<string, SourceIndexDefinition[]>();

  for (const definition of definitions) {
    const fileDefinitions = byExporterFile.get(definition.file);
    if (fileDefinitions) {
      fileDefinitions.push(definition);
    } else {
      byExporterFile.set(definition.file, [definition]);
    }

    for (const exportName of definition.exportNames) {
      const key = createExportSiteKey(definition.file, exportName);
      const existing = byExportSite.get(key);
      if (existing) {
        existing.push(definition);
      } else {
        byExportSite.set(key, [definition]);
      }
    }

    const declarationFile = definition.filePath ?? definition.file;
    const declarationKey = createDeclarationSiteKey(declarationFile, definition.line);
    const existing = byDeclarationSite.get(declarationKey);
    if (existing) {
      existing.push(definition);
      continue;
    }

    byDeclarationSite.set(declarationKey, [definition]);
  }

  return {
    byExportSite,
    byDeclarationSite,
    byExporterFile,
  };
}

function getDefinitionKindRank(kind: SourceIndexDefinition['kind'], usageKind: SourceIndexUsage['kind']) {
  const runtimeRank: Record<SourceIndexDefinition['kind'], number> = {
    component: 0,
    class: 1,
    function: 2,
    hook: 3,
    constant: 4,
    enum: 5,
    namespace: 6,
    interface: 7,
    type: 8,
  };

  const typeRank: Record<SourceIndexDefinition['kind'], number> = {
    interface: 0,
    type: 1,
    enum: 2,
    namespace: 3,
    class: 4,
    component: 5,
    function: 6,
    hook: 7,
    constant: 8,
  };

  const extendsRank: Record<SourceIndexDefinition['kind'], number> = {
    class: 0,
    component: 1,
    interface: 2,
    namespace: 3,
    type: 4,
    enum: 5,
    function: 6,
    hook: 7,
    constant: 8,
  };

  const implementsRank: Record<SourceIndexDefinition['kind'], number> = {
    interface: 0,
    class: 1,
    type: 2,
    namespace: 3,
    enum: 4,
    component: 5,
    function: 6,
    hook: 7,
    constant: 8,
  };

  switch (usageKind) {
    case 'type-reference':
    case 'type-import':
      return typeRank[kind];
    case 'extends':
      return extendsRank[kind];
    case 'implements':
      return implementsRank[kind];
    default:
      return runtimeRank[kind];
  }
}

function selectDefinitionCandidate(
  candidates: SourceIndexDefinition[],
  usageKind: SourceIndexUsage['kind'],
  preferredName: string | null,
) {
  const matchingCandidates =
    preferredName === null
      ? candidates
      : candidates.filter(
          (definition) =>
            definition.name === preferredName ||
            definition.exportNames.includes(preferredName) ||
            definition.exportedAs?.includes(preferredName),
        );

  const pool = matchingCandidates.length > 0 ? matchingCandidates : candidates;
  return [...pool].sort((left, right) => {
    const rankDifference = getDefinitionKindRank(left.kind, usageKind) - getDefinitionKindRank(right.kind, usageKind);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

function filterDefinitionCandidatesByName(candidates: SourceIndexDefinition[], preferredName: string | null) {
  if (preferredName === null) {
    return candidates;
  }

  return candidates.filter(
    (definition) =>
      definition.name === preferredName ||
      definition.exportNames.includes(preferredName) ||
      definition.exportedAs?.includes(preferredName),
  );
}

function resolveModuleRelativePath(
  moduleSourceFile: SourceFile | undefined,
  relativePathByAbsolute: Map<string, string>,
) {
  if (!moduleSourceFile) {
    return null;
  }

  return relativePathByAbsolute.get(moduleSourceFile.getFilePath()) ?? null;
}

function resolveBindingFromDeclaration(
  declaration: Node,
  relativePathByAbsolute: Map<string, string>,
): ImportBindingInfo | null {
  if (Node.isImportClause(declaration)) {
    const defaultImport = declaration.getDefaultImport();
    if (!defaultImport) {
      return null;
    }
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    if (!importDeclaration) {
      return null;
    }

    return {
      kind: 'default',
      exportName: 'default',
      localName: defaultImport.getText(),
      resolvedPath: resolveModuleRelativePath(
        importDeclaration.getModuleSpecifierSourceFile(),
        relativePathByAbsolute,
      ),
      isTypeOnly: importDeclaration.isTypeOnly(),
    };
  }

  if (Node.isImportSpecifier(declaration)) {
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    if (!importDeclaration) {
      return null;
    }

    return {
      kind: 'named',
      exportName: declaration.getName(),
      localName: declaration.getAliasNode()?.getText() ?? declaration.getName(),
      resolvedPath: resolveModuleRelativePath(
        importDeclaration.getModuleSpecifierSourceFile(),
        relativePathByAbsolute,
      ),
      isTypeOnly: declaration.isTypeOnly() || importDeclaration.isTypeOnly(),
    };
  }

  if (Node.isNamespaceImport(declaration)) {
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    if (!importDeclaration) {
      return null;
    }

    return {
      kind: 'namespace',
      exportName: null,
      localName: declaration.getText().replace(/^\*\s+as\s+/, ''),
      resolvedPath: resolveModuleRelativePath(
        importDeclaration.getModuleSpecifierSourceFile(),
        relativePathByAbsolute,
      ),
      isTypeOnly: importDeclaration.isTypeOnly(),
    };
  }

  return null;
}

function resolveBindingFromSymbol(symbol: MorphSymbol | undefined, relativePathByAbsolute: Map<string, string>) {
  const declaration = symbol?.getDeclarations().at(0);
  if (!declaration) {
    return null;
  }

  return resolveBindingFromDeclaration(declaration, relativePathByAbsolute);
}

function resolveDefinitionFromSymbol(
  symbol: MorphSymbol | undefined,
  preferredName: string | null,
  lookups: DefinitionLookups,
  relativePathByAbsolute: Map<string, string>,
  usageKind: SourceIndexUsage['kind'],
) {
  const unwrapped = unwrapAliasedSymbol(symbol);
  const fallbackName = preferredName ?? unwrapped?.getName() ?? null;

  for (const declaration of unwrapped?.getDeclarations() ?? []) {
    const declarationFile = relativePathByAbsolute.get(declaration.getSourceFile().getFilePath());
    if (!declarationFile) {
      continue;
    }

    const declarationKey = createDeclarationSiteKey(declarationFile, getNodeLine(declaration));
    const definitions = lookups.byDeclarationSite.get(declarationKey) ?? [];
    if (definitions.length === 0) {
      continue;
    }

    const matchingDefinitions = filterDefinitionCandidatesByName(definitions, fallbackName);
    if (fallbackName && matchingDefinitions.length === 0) {
      continue;
    }

    if (matchingDefinitions.length > 0) {
      return selectDefinitionCandidate(matchingDefinitions, usageKind, fallbackName);
    }

    const directDefinitions = definitions.filter((definition) => definition.file === declarationFile);
    if (directDefinitions.length > 0) {
      return selectDefinitionCandidate(directDefinitions, usageKind, fallbackName);
    }

    return selectDefinitionCandidate(definitions, usageKind, fallbackName);
  }

  return null;
}

function resolveDefinitionFromBinding(
  binding: ImportBindingInfo,
  lookups: DefinitionLookups,
  relativePathByAbsolute: Map<string, string>,
  symbol: MorphSymbol | undefined,
  usageKind: SourceIndexUsage['kind'],
  exportNameOverride?: string,
) {
  const exportName = exportNameOverride ?? binding.exportName;
  if (binding.resolvedPath && exportName) {
    const exportSiteDefinitions = lookups.byExportSite.get(createExportSiteKey(binding.resolvedPath, exportName));
    if (exportSiteDefinitions && exportSiteDefinitions.length > 0) {
      if (exportSiteDefinitions.length === 1) {
        return exportSiteDefinitions[0];
      }

      const declarationDefinition = resolveDefinitionFromSymbol(
        symbol,
        exportName ?? binding.localName,
        lookups,
        relativePathByAbsolute,
        usageKind,
      );
      if (declarationDefinition) {
        const matchedDefinition = exportSiteDefinitions.find((definition) => definition.id === declarationDefinition.id);
        if (matchedDefinition) {
          return matchedDefinition;
        }
      }

      return selectDefinitionCandidate(exportSiteDefinitions, usageKind, exportName ?? binding.localName);
    }
  }

  return resolveDefinitionFromSymbol(symbol, exportName ?? binding.localName, lookups, relativePathByAbsolute, usageKind);
}

function resolveNamespaceDefinitionFromBinding(
  binding: ImportBindingInfo,
  lookups: DefinitionLookups,
  relativePathByAbsolute: Map<string, string>,
  symbol: MorphSymbol | undefined,
  usageKind: SourceIndexUsage['kind'],
) {
  if (binding.kind === 'namespace') {
    return null;
  }

  const definition = resolveDefinitionFromBinding(
    binding,
    lookups,
    relativePathByAbsolute,
    symbol,
    usageKind,
  );

  return definition?.kind === 'namespace' ? definition : null;
}

function isImportBindingIdentifier(identifier: Node) {
  const parent = identifier.getParent();
  return Node.isImportClause(parent) || Node.isImportSpecifier(parent) || Node.isNamespaceImport(parent);
}

function isDeclarationNameIdentifier(identifier: Node) {
  const parent = identifier.getParent();
  return (
    (Node.isVariableDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isFunctionDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isFunctionExpression(parent) && parent.getNameNode() === identifier) ||
    (Node.isClassDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isClassExpression(parent) && parent.getNameNode() === identifier) ||
    (Node.isInterfaceDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isTypeAliasDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isEnumDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isModuleDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isParameterDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isTypeParameterDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isBindingElement(parent) &&
      (parent.getNameNode() === identifier || parent.getPropertyNameNode() === identifier))
  );
}

function isNamespacePropertyAccess(identifier: Node) {
  const parent = identifier.getParent();
  return Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier;
}

function isQualifiedNameIdentifier(identifier: Node) {
  return Boolean(identifier.getFirstAncestorByKind(SyntaxKind.QualifiedName));
}

function isExportSyntaxIdentifier(identifier: Node) {
  const parent = identifier.getParent();
  return Node.isExportSpecifier(parent) || Node.isNamespaceExport(parent);
}

function isPropertyNameIdentifier(identifier: Node) {
  const parent = identifier.getParent();
  return (
    (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) ||
    (Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === identifier) ||
    (Node.isPropertySignature(parent) && parent.getNameNode() === identifier) ||
    (Node.isPropertyDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isMethodSignature(parent) && parent.getNameNode() === identifier) ||
    (Node.isMethodDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isGetAccessorDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isSetAccessorDeclaration(parent) && parent.getNameNode() === identifier) ||
    (Node.isEnumMember(parent) && parent.getNameNode() === identifier) ||
    (Node.isJsxAttribute(parent) && parent.getNameNode() === identifier)
  );
}

function isSupportedUnboundUsageKind(usageKind: SourceIndexUsage['kind']) {
  return usageKind !== 'reference';
}

function resolveModuleReferenceDefinition(
  resolvedPath: string,
  exportName: string,
  lookups: DefinitionLookups,
) {
  const candidates =
    lookups.byExportSite
      .get(createExportSiteKey(resolvedPath, exportName))
      ?.filter((definition) => isRuntimeDefinition(definition)) ?? [];

  if (candidates.length === 0) {
    return null;
  }

  return selectDefinitionCandidate(candidates, 'import', exportName);
}

function isTypePositionIdentifier(identifier: Node) {
  if (identifier.getFirstAncestorByKind(SyntaxKind.TypeQuery)) {
    return true;
  }

  const parent = identifier.getParent();
  if (Node.isTypeReference(parent)) {
    return parent.getTypeName() === identifier;
  }

  if (Node.isExpressionWithTypeArguments(parent)) {
    return parent.getExpression() === identifier;
  }

  return false;
}

function getQualifiedNameRootIdentifier(node: Node): Node | null {
  let current: Node = node;
  while (Node.isQualifiedName(current)) {
    current = current.getLeft();
  }

  return Node.isIdentifier(current) ? current : null;
}

function isJsxTagReference(node: Node) {
  const parent = node.getParent();
  if (
    Node.isJsxOpeningElement(parent) ||
    Node.isJsxClosingElement(parent) ||
    Node.isJsxSelfClosingElement(parent)
  ) {
    return parent.getTagNameNode() === node;
  }

  if (Node.isPropertyAccessExpression(parent)) {
    const grandparent = parent.getParent();
    if (
      Node.isJsxOpeningElement(grandparent) ||
      Node.isJsxClosingElement(grandparent) ||
      Node.isJsxSelfClosingElement(grandparent)
    ) {
      return grandparent.getTagNameNode() === parent;
    }
  }

  return false;
}

function inferUsageKind(node: Node): SourceIndexUsage['kind'] {
  if (isTypePositionIdentifier(node)) {
    return 'type-reference';
  }

  if (isJsxTagReference(node)) {
    return 'jsx';
  }

  const heritageClause = node.getFirstAncestorByKind(SyntaxKind.HeritageClause);
  if (heritageClause) {
    return heritageClause.getToken() === SyntaxKind.ExtendsKeyword ? 'extends' : 'implements';
  }

  const callExpression = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
  if (callExpression) {
    const expression = callExpression.getExpression();
    if (expression === node || (Node.isPropertyAccessExpression(expression) && expression.getNameNode() === node)) {
      return 'call';
    }
  }

  return 'reference';
}

function createUsageRecord(
  definition: SourceIndexDefinition | null,
  file: string,
  symbol: string,
  targetFile: string | null,
  line: number,
  kind: SourceIndexUsage['kind'],
  importedAs?: string,
  namespaceAlias?: string,
): SourceIndexUsage {
  return {
    kind,
    definitionId: definition?.id ?? null,
    file,
    symbol,
    targetFile,
    line,
    importedAs,
    namespaceAlias,
  };
}

function isTypeSideDefinition(definition: SourceIndexDefinition) {
  return (
    definition.kind === 'interface' ||
    definition.kind === 'type' ||
    definition.kind === 'enum' ||
    definition.kind === 'class' ||
    definition.kind === 'namespace'
  );
}

function isRuntimeDefinition(definition: SourceIndexDefinition) {
  return definition.kind !== 'interface' && definition.kind !== 'type';
}

function resolveWildcardReExportDefinitions(
  resolvedPath: string,
  lookups: DefinitionLookups,
  isTypeOnly: boolean,
) {
  return (lookups.byExporterFile.get(resolvedPath) ?? []).filter((definition) => {
    if (definition.isDefaultExport || definition.exportNames.includes('default')) {
      return false;
    }

    if (isTypeOnly && !isTypeSideDefinition(definition)) {
      return false;
    }

    return true;
  });
}

export function collectSemanticUsages(
  semanticProject: Pick<SemanticProjectBootstrap, 'checker' | 'sourceFileEntries'>,
  definitions: SourceIndexDefinition[],
): SourceIndexUsage[] {
  const lookups = buildDefinitionLookups(definitions);
  const relativePathByAbsolute = new Map(
    semanticProject.sourceFileEntries.map((entry) => [entry.sourceFile.getFilePath(), entry.relativePath]),
  );
  const usages: SourceIndexUsage[] = [];
  const seenUsages = new Set<string>();

  const pushUsage = (usage: SourceIndexUsage) => {
    if (!usage.definitionId && !usage.targetFile) {
      return;
    }

    const dedupeKey = JSON.stringify(usage);
    if (seenUsages.has(dedupeKey)) {
      return;
    }

    seenUsages.add(dedupeKey);
    usages.push(usage);
  };

  for (const entry of semanticProject.sourceFileEntries) {
    for (const importDeclaration of entry.sourceFile.getImportDeclarations()) {
      const resolvedPath = resolveModuleRelativePath(
        importDeclaration.getModuleSpecifierSourceFile(),
        relativePathByAbsolute,
      );
      const importIsTypeOnly = importDeclaration.isTypeOnly();

      const defaultImport = importDeclaration.getDefaultImport();
      if (defaultImport && importIsTypeOnly) {
        const binding: ImportBindingInfo = {
          kind: 'default',
          exportName: 'default',
          localName: defaultImport.getText(),
          resolvedPath,
          isTypeOnly: true,
        };
        const definition = resolveDefinitionFromBinding(
          binding,
          lookups,
          relativePathByAbsolute,
          semanticProject.checker.getSymbolAtLocation(defaultImport),
          'type-import',
        );
        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            binding.localName,
            definition?.file ?? binding.resolvedPath,
            getNodeLine(defaultImport),
            'type-import',
            binding.localName,
          ),
        );
      }

      for (const importSpecifier of importDeclaration.getNamedImports()) {
        if (!(importIsTypeOnly || importSpecifier.isTypeOnly())) {
          continue;
        }

        const binding: ImportBindingInfo = {
          kind: 'named',
          exportName: importSpecifier.getName(),
          localName: importSpecifier.getAliasNode()?.getText() ?? importSpecifier.getName(),
          resolvedPath,
          isTypeOnly: true,
        };
        const bindingNode = importSpecifier.getAliasNode() ?? importSpecifier.getNameNode();
        const definition = resolveDefinitionFromBinding(
          binding,
          lookups,
          relativePathByAbsolute,
          semanticProject.checker.getSymbolAtLocation(bindingNode),
          'type-import',
        );
        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            binding.localName,
            definition?.file ?? binding.resolvedPath,
            getNodeLine(bindingNode),
            'type-import',
            binding.localName,
          ),
        );
      }
    }

    for (const reference of collectSemanticModuleReferences(entry.sourceFile, relativePathByAbsolute)) {
      if (!reference.resolvedPath) {
        continue;
      }

      const exportNames =
        reference.accessedExports.length > 0
          ? reference.accessedExports
          : reference.kind === 'dynamic-import'
            ? ['default']
            : [];

      for (const exportName of exportNames) {
        const definition = resolveModuleReferenceDefinition(reference.resolvedPath, exportName, lookups);
        if (!definition) {
          continue;
        }

        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            exportName === 'default' ? definition.name : exportName,
            definition.file,
            reference.line,
            'import',
          ),
        );
      }
    }

    for (const exportDeclaration of entry.sourceFile.getExportDeclarations()) {
      const resolvedPath = resolveModuleRelativePath(
        exportDeclaration.getModuleSpecifierSourceFile(),
        relativePathByAbsolute,
      );
      const exportIsTypeOnly = exportDeclaration.isTypeOnly();
      const namespaceExport = exportDeclaration.getNamespaceExport();

      if (namespaceExport && resolvedPath) {
        pushUsage(
          createUsageRecord(
            null,
            entry.relativePath,
            namespaceExport.getName(),
            resolvedPath,
            getNodeLine(namespaceExport),
            're-export',
            namespaceExport.getName(),
          ),
        );
      }

      if (!namespaceExport && exportDeclaration.getNamedExports().length === 0 && resolvedPath) {
        for (const definition of resolveWildcardReExportDefinitions(resolvedPath, lookups, exportIsTypeOnly)) {
          const exportName = definition.exportNames.find((name) => name !== 'default') ?? definition.name;
          pushUsage(
            createUsageRecord(
              definition,
              entry.relativePath,
              exportName,
              definition.filePath ?? resolvedPath,
              getNodeLine(exportDeclaration),
              're-export',
              exportName,
            ),
          );
        }
      }

      for (const exportSpecifier of exportDeclaration.getNamedExports()) {
        const exportedName = exportSpecifier.getAliasNode()?.getText() ?? exportSpecifier.getName();
        const localName = exportSpecifier.getName();
        const definition =
          resolvedPath
            ? resolveDefinitionFromBinding(
                {
                  kind: 'named',
                  exportName: localName,
                  localName,
                  resolvedPath,
                  isTypeOnly: exportIsTypeOnly,
                },
                lookups,
                relativePathByAbsolute,
                semanticProject.checker.getSymbolAtLocation(exportSpecifier.getNameNode()),
                're-export',
              )
            : (() => {
                const targetSymbol = exportSpecifier.getLocalTargetSymbol();
                const binding = resolveBindingFromSymbol(targetSymbol, relativePathByAbsolute);
                if (!binding || binding.kind === 'namespace') {
                  return null;
                }

                return resolveDefinitionFromBinding(
                  binding,
                  lookups,
                  relativePathByAbsolute,
                  targetSymbol,
                  're-export',
                );
              })();
        const targetSymbol = exportSpecifier.getLocalTargetSymbol();
        const binding = targetSymbol ? resolveBindingFromSymbol(targetSymbol, relativePathByAbsolute) : null;
        const targetFile = definition?.file ?? binding?.resolvedPath ?? resolvedPath;
        if (!targetFile) {
          continue;
        }

        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            exportedName,
            targetFile,
            getNodeLine(exportSpecifier),
            're-export',
            localName,
          ),
        );
      }
    }

    for (const qualifiedName of entry.sourceFile.getDescendantsOfKind(SyntaxKind.QualifiedName)) {
      const rootIdentifier = getQualifiedNameRootIdentifier(qualifiedName.getLeft());
      if (!rootIdentifier) {
        continue;
      }

      const namespaceSymbol = semanticProject.checker.getSymbolAtLocation(rootIdentifier);
      const binding = resolveBindingFromSymbol(namespaceSymbol, relativePathByAbsolute);
      if (!binding) {
        continue;
      }

      const namespaceDefinition = resolveNamespaceDefinitionFromBinding(
        binding,
        lookups,
        relativePathByAbsolute,
        namespaceSymbol,
        'type-reference',
      );
      if (binding.kind !== 'namespace' && !namespaceDefinition) {
        continue;
      }

      const definition =
        binding.kind === 'namespace'
          ? resolveDefinitionFromBinding(
              binding,
              lookups,
              relativePathByAbsolute,
              semanticProject.checker.getSymbolAtLocation(qualifiedName),
              'type-reference',
              qualifiedName.getRight().getText(),
            )
          : resolveDefinitionFromSymbol(
              semanticProject.checker.getSymbolAtLocation(qualifiedName),
              qualifiedName.getRight().getText(),
              lookups,
              relativePathByAbsolute,
              'type-reference',
            );

      pushUsage(
        createUsageRecord(
          definition,
          entry.relativePath,
          qualifiedName.getRight().getText(),
          definition?.file ?? namespaceDefinition?.filePath ?? binding.resolvedPath,
          getNodeLine(qualifiedName),
          'type-reference',
          undefined,
          qualifiedName.getLeft().getText(),
        ),
      );
    }

    for (const identifier of entry.sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (isImportBindingIdentifier(identifier)) {
        continue;
      }

      if (isDeclarationNameIdentifier(identifier)) {
        continue;
      }

      if (isExportSyntaxIdentifier(identifier)) {
        continue;
      }

      if (isQualifiedNameIdentifier(identifier)) {
        continue;
      }

      if (isPropertyNameIdentifier(identifier)) {
        continue;
      }

      const parent = identifier.getParent();
      if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === identifier) {
        continue;
      }

      if (isNamespacePropertyAccess(identifier)) {
        const propertyAccess = identifier.getParentIfKind(SyntaxKind.PropertyAccessExpression);
        const namespaceSymbol = propertyAccess
          ? semanticProject.checker.getSymbolAtLocation(propertyAccess.getExpression())
          : undefined;
        const binding = resolveBindingFromSymbol(namespaceSymbol, relativePathByAbsolute);
        if (!binding || binding.isTypeOnly) {
          continue;
        }

        const usageKind = inferUsageKind(identifier);
        const namespaceDefinition = resolveNamespaceDefinitionFromBinding(
          binding,
          lookups,
          relativePathByAbsolute,
          namespaceSymbol,
          usageKind,
        );
        if (binding.kind !== 'namespace' && !namespaceDefinition) {
          continue;
        }

        const definition =
          binding.kind === 'namespace'
            ? resolveDefinitionFromBinding(
                binding,
                lookups,
                relativePathByAbsolute,
                undefined,
                usageKind,
                identifier.getText(),
              )
            : resolveDefinitionFromSymbol(
                semanticProject.checker.getSymbolAtLocation(identifier) ??
                  (propertyAccess ? semanticProject.checker.getSymbolAtLocation(propertyAccess) : undefined),
                identifier.getText(),
                lookups,
                relativePathByAbsolute,
                usageKind,
              );
        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            identifier.getText(),
            definition?.file ?? namespaceDefinition?.filePath ?? binding.resolvedPath,
            getNodeLine(identifier),
            usageKind,
            undefined,
            binding.localName,
          ),
        );
        continue;
      }

      const symbol = semanticProject.checker.getSymbolAtLocation(identifier);
      const binding = resolveBindingFromSymbol(symbol, relativePathByAbsolute);
      if (!binding) {
        const usageKind = inferUsageKind(identifier);
        if (!isSupportedUnboundUsageKind(usageKind)) {
          continue;
        }

        const definition = resolveDefinitionFromSymbol(
          symbol,
          identifier.getText(),
          lookups,
          relativePathByAbsolute,
          usageKind,
        );
        if (!definition) {
          continue;
        }

        if (usageKind === 'jsx' && definition.kind !== 'component') {
          continue;
        }

        pushUsage(
          createUsageRecord(
            definition,
            entry.relativePath,
            identifier.getText(),
            definition.filePath ?? definition.file,
            getNodeLine(identifier),
            usageKind,
          ),
        );
        continue;
      }

      if (binding.kind === 'namespace') {
        continue;
      }

      if (binding.isTypeOnly && !isTypePositionIdentifier(identifier)) {
        continue;
      }

      const usageKind = inferUsageKind(identifier);
      const definition = resolveDefinitionFromBinding(
        binding,
        lookups,
        relativePathByAbsolute,
        symbol,
        usageKind,
      );
      pushUsage(
        createUsageRecord(
          definition,
          entry.relativePath,
          identifier.getText(),
          definition?.file ?? binding.resolvedPath,
          getNodeLine(identifier),
          usageKind,
          binding.localName,
        ),
      );
    }
  }

  return usages.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    if (left.symbol !== right.symbol) {
      return left.symbol.localeCompare(right.symbol);
    }
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return (left.definitionId ?? '').localeCompare(right.definitionId ?? '');
  });
}
