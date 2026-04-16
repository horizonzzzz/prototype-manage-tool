import { createHash } from 'node:crypto';

import {
  Node,
  SyntaxKind,
  type ClassLikeDeclarationBase,
  type ExportedDeclarations,
  type Node as MorphNode,
  type SourceFile,
} from 'ts-morph';

import type { SemanticProjectBootstrap } from '@/lib/server/source-index-semantic-project';
import type { SourceIndexDefinition } from '@/lib/server/source-index-types';

type DefinitionSite = {
  exporterFile: string;
  exportName: string | null;
  declaration: SemanticExportDeclaration;
  declarationFile: string;
  declarationLine: number;
  exportLine: number;
};

type SemanticExportDeclaration = ExportedDeclarations | SourceFile;

function getNodeLine(node: MorphNode) {
  return node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
}

function getDeclarationName(declaration: SemanticExportDeclaration) {
  if (Node.isVariableDeclaration(declaration)) {
    return declaration.getName();
  }

  if (Node.isFunctionDeclaration(declaration) || Node.isClassDeclaration(declaration)) {
    return declaration.getName();
  }

  if (
    Node.isInterfaceDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isModuleDeclaration(declaration)
  ) {
    return declaration.getName();
  }

  if (Node.isArrowFunction(declaration) || Node.isFunctionExpression(declaration)) {
    return getFunctionLikeSymbolName(declaration);
  }

  if (Node.isClassExpression(declaration)) {
    return declaration.getName();
  }

  if (Node.isExportAssignment(declaration)) {
    const expression = declaration.getExpression();
    if (Node.isIdentifier(expression)) {
      return expression.getText();
    }

    if (Node.isFunctionExpression(expression) || Node.isArrowFunction(expression)) {
      return getFunctionLikeSymbolName(expression);
    }

    if (Node.isClassExpression(expression)) {
      return expression.getName();
    }
  }

  return null;
}

function deriveDefaultExportName(exporterFile: string) {
  const fileName = exporterFile.split('/').at(-1) ?? exporterFile;
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const normalized = baseName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join('');
  return normalized || 'DefaultExport';
}

function inferDefinitionKind(
  site: DefinitionSite,
  resolvedName: string,
): SourceIndexDefinition['kind'] | null {
  const { declaration } = site;

  if (Node.isSourceFile(declaration)) {
    return 'namespace';
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return 'interface';
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return 'type';
  }

  if (Node.isEnumDeclaration(declaration)) {
    return 'enum';
  }

  if (Node.isModuleDeclaration(declaration)) {
    return 'namespace';
  }

  if (Node.isClassDeclaration(declaration)) {
    return isClassComponentDeclaration(declaration) ? 'component' : 'class';
  }

  if (Node.isFunctionDeclaration(declaration)) {
    if (isHookName(resolvedName)) {
      return 'hook';
    }
    return isFunctionLikeComponent(declaration, resolvedName) ? 'component' : 'function';
  }

  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    if (isHookName(resolvedName) && initializer && isVariableHookLikeInitializer(initializer)) {
      return 'hook';
    }

    if (
      initializer &&
      (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ) {
      if (isFunctionLikeComponent(initializer, resolvedName)) {
        return 'component';
      }
      return 'function';
    }

    if (initializer && Node.isCallExpression(initializer) && isComponentWrapperCall(initializer)) {
      return 'component';
    }

    if (initializer && Node.isClassExpression(initializer)) {
      return isClassComponentDeclaration(initializer) ? 'component' : 'class';
    }

    return 'constant';
  }

  if (Node.isExportAssignment(declaration)) {
    const expression = declaration.getExpression();

    if (Node.isArrowFunction(expression) || Node.isFunctionExpression(expression)) {
      if (isHookName(resolvedName)) {
        return 'hook';
      }
      return isFunctionLikeComponent(expression, resolvedName) ? 'component' : 'function';
    }

    if (Node.isClassExpression(expression)) {
      return isClassComponentDeclaration(expression) ? 'component' : 'class';
    }

    if (Node.isCallExpression(expression) && isComponentWrapperCall(expression)) {
      return 'component';
    }

    return 'constant';
  }

  return null;
}

function isJsxBearingFile(node: MorphNode) {
  const extension = node.getSourceFile().getExtension().toLowerCase();
  return extension === '.tsx' || extension === '.jsx';
}

function containsJsx(node: MorphNode) {
  return (
    node.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

function isFunctionLikeComponent(node: MorphNode, resolvedName?: string) {
  if (!isJsxBearingFile(node)) {
    return false;
  }

  if (!containsJsx(node)) {
    return false;
  }

  const symbolName = resolvedName ?? getFunctionLikeSymbolName(node);
  if (!symbolName) {
    return false;
  }

  return isPascalCaseName(symbolName);
}

function hasRenderMethodWithJsx(declaration: ClassLikeDeclarationBase & MorphNode) {
  const renderMethod = declaration.getInstanceMethod('render');
  if (!renderMethod) {
    return false;
  }

  return containsJsx(renderMethod);
}

function isReactComponentHeritage(declaration: ClassLikeDeclarationBase & MorphNode) {
  const extendsExpression = declaration.getExtends()?.getExpression();
  if (!extendsExpression) {
    return false;
  }

  if (Node.isIdentifier(extendsExpression)) {
    return extendsExpression.getText() === 'Component' || extendsExpression.getText() === 'PureComponent';
  }

  if (Node.isPropertyAccessExpression(extendsExpression)) {
    const propertyName = extendsExpression.getNameNode().getText();
    return propertyName === 'Component' || propertyName === 'PureComponent';
  }

  return false;
}

function isClassComponentDeclaration(declaration: ClassLikeDeclarationBase & MorphNode) {
  if (!isJsxBearingFile(declaration)) {
    return false;
  }

  return hasRenderMethodWithJsx(declaration) || isReactComponentHeritage(declaration);
}

function getFunctionLikeSymbolName(node: MorphNode) {
  if (Node.isFunctionDeclaration(node)) {
    return node.getName();
  }

  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    const variable = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (variable) {
      return variable.getName();
    }
  }

  return null;
}

function isPascalCaseName(name: string) {
  const firstCharacter = name[0];
  return Boolean(firstCharacter && firstCharacter >= 'A' && firstCharacter <= 'Z');
}

function isHookName(name: string) {
  if (!name.startsWith('use') || name.length <= 3) {
    return false;
  }

  const fourthCharacter = name[3];
  return fourthCharacter >= 'A' && fourthCharacter <= 'Z';
}

function isComponentWrapperCall(node: MorphNode) {
  if (!Node.isCallExpression(node)) {
    return false;
  }

  const expression = node.getExpression();
  if (Node.isIdentifier(expression)) {
    return expression.getText() === 'memo' || expression.getText() === 'forwardRef';
  }

  if (Node.isPropertyAccessExpression(expression)) {
    const propertyName = expression.getNameNode().getText();
    return propertyName === 'memo' || propertyName === 'forwardRef';
  }

  return false;
}

function isHookLikeCallExpression(node: MorphNode) {
  if (!Node.isCallExpression(node)) {
    return false;
  }

  const expression = node.getExpression();
  if (Node.isIdentifier(expression)) {
    return isHookName(expression.getText());
  }

  if (Node.isPropertyAccessExpression(expression)) {
    return isHookName(expression.getNameNode().getText());
  }

  return false;
}

function isVariableHookLikeInitializer(node: MorphNode) {
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return true;
  }

  return isHookLikeCallExpression(node);
}

function createDefinitionId(
  exporterFile: string,
  exportName: string | null,
  declarationFile: string,
  declarationLine: number,
  resolvedName: string,
  kind: SourceIndexDefinition['kind'],
) {
  const payload = JSON.stringify({
    exporterFile,
    exportName,
    declarationFile,
    declarationLine,
    resolvedName,
    kind,
  });
  return `def:${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`;
}

function resolveExportSiteLine(
  sourceFile: SemanticProjectBootstrap['sourceFileEntries'][number]['sourceFile'],
  exportName: string | null,
  declaration: SemanticExportDeclaration,
) {
  if (exportName === null) {
    return getNodeLine(declaration);
  }

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const namespaceExport = exportDeclaration.getNamespaceExport();
    if (namespaceExport && namespaceExport.getName() === exportName) {
      return getNodeLine(namespaceExport);
    }

    const namedExport = exportDeclaration
      .getNamedExports()
      .find((specifier) => (specifier.getAliasNode()?.getText() ?? specifier.getName()) === exportName);
    if (namedExport) {
      return getNodeLine(namedExport);
    }

    if (
      !namespaceExport &&
      exportDeclaration.getNamedExports().length === 0 &&
      exportDeclaration.getModuleSpecifierSourceFile()?.getFilePath() === declaration.getSourceFile().getFilePath()
    ) {
      return getNodeLine(exportDeclaration);
    }
  }

  if (exportName === 'default') {
    const exportAssignment = sourceFile.getExportAssignments().find((assignment) => !assignment.isExportEquals());
    if (exportAssignment) {
      return getNodeLine(exportAssignment);
    }
  }

  return getNodeLine(declaration);
}

function collectTopLevelDeclarations(sourceFile: SourceFile): SemanticExportDeclaration[] {
  return [
    ...sourceFile.getFunctions(),
    ...sourceFile.getClasses(),
    ...sourceFile.getInterfaces(),
    ...sourceFile.getTypeAliases(),
    ...sourceFile.getEnums(),
    ...sourceFile.getModules(),
    ...sourceFile.getVariableStatements().flatMap((statement) => statement.getDeclarations()),
  ];
}

function isTopLevelDeclarationExported(declaration: SemanticExportDeclaration) {
  if (Node.isVariableDeclaration(declaration)) {
    return declaration.getFirstAncestorByKind(SyntaxKind.VariableStatement)?.hasExportKeyword() ?? false;
  }

  if (
    Node.isFunctionDeclaration(declaration) ||
    Node.isClassDeclaration(declaration) ||
    Node.isInterfaceDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isModuleDeclaration(declaration)
  ) {
    return declaration.hasExportKeyword();
  }

  return false;
}

export function collectSemanticDefinitions(
  semanticProject: Pick<SemanticProjectBootstrap, 'sourceFileEntries'>,
): SourceIndexDefinition[] {
  const relativePathByAbsolute = new Map(
    semanticProject.sourceFileEntries.map((entry) => [entry.sourceFile.getFilePath(), entry.relativePath]),
  );
  const definitions: SourceIndexDefinition[] = [];
  const seenDefinitionIds = new Set<string>();

  for (const entry of semanticProject.sourceFileEntries) {
    const exportedDeclarations = entry.sourceFile.getExportedDeclarations();
    const exporterFile = entry.relativePath;

    const collectFromDeclaration = (exportName: string | null, declaration: SemanticExportDeclaration) => {
      const declarationFile = relativePathByAbsolute.get(declaration.getSourceFile().getFilePath());
      if (!declarationFile) {
        return;
      }

      const declarationName = getDeclarationName(declaration);
      const resolvedName =
        exportName === null
          ? declarationName
          : exportName === 'default'
          ? (declarationName ?? deriveDefaultExportName(exporterFile))
          : exportName;
      if (!resolvedName) {
        return;
      }

      const declarationLine = getNodeLine(declaration);
      const exportLine = resolveExportSiteLine(entry.sourceFile, exportName, declaration);
      const site: DefinitionSite = {
        exporterFile,
        exportName,
        declaration,
        declarationFile,
        declarationLine,
        exportLine,
      };

      const kind = inferDefinitionKind(site, resolvedName);
      if (!kind) {
        return;
      }

      const id = createDefinitionId(exporterFile, exportName, declarationFile, declarationLine, resolvedName, kind);
      if (seenDefinitionIds.has(id)) {
        return;
      }
      seenDefinitionIds.add(id);

      definitions.push({
        id,
        name: resolvedName,
        kind,
        file: exportName === null ? declarationFile : exporterFile,
        line: exportLine,
        exportNames: exportName === null ? [] : [exportName],
        isDefaultExport: exportName === 'default',
        filePath: declarationFile,
        exportedAs:
          exportName !== null && declarationName && declarationName !== exportName
            ? [exportName, declarationName]
            : exportName !== null
              ? [exportName]
              : undefined,
      });
    };

    for (const [exportName, declarations] of exportedDeclarations) {
      for (const declaration of declarations) {
        collectFromDeclaration(exportName, declaration);
      }
    }

    for (const exportAssignment of entry.sourceFile.getExportAssignments()) {
      if (exportAssignment.isExportEquals()) {
        continue;
      }

      collectFromDeclaration('default', exportAssignment as unknown as ExportedDeclarations);
    }

    for (const declaration of collectTopLevelDeclarations(entry.sourceFile)) {
      if (isTopLevelDeclarationExported(declaration)) {
        continue;
      }

      collectFromDeclaration(null, declaration);
    }
  }

  return definitions
    .sort((left, right) => {
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }
      if (left.line !== right.line) {
        return left.line - right.line;
      }
      if (left.name !== right.name) {
        return left.name.localeCompare(right.name);
      }
      if ((left.exportNames[0] ?? '') !== (right.exportNames[0] ?? '')) {
        return (left.exportNames[0] ?? '').localeCompare(right.exportNames[0] ?? '');
      }
      return left.id.localeCompare(right.id);
    });
}
