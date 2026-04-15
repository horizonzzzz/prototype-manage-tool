import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fse from 'fs-extra';
import { SyntaxKind } from 'ts-morph';
import { afterEach, describe, expect, test } from 'vitest';

import { buildSourceIndexArtifact } from '@/lib/server/source-index-builder';
import { createSemanticProject } from '@/lib/server/source-index-semantic-project';
import { unwrapAliasedSymbol } from '@/lib/server/source-index-semantic-symbols';
import type { SourceIndexUsage } from '@/lib/server/source-index-types';

function pickUsageFields(usage: SourceIndexUsage) {
  return {
    kind: usage.kind,
    file: usage.file,
    symbol: usage.symbol,
    targetFile: usage.targetFile,
    line: usage.line,
    importedAs: usage.importedAs,
    namespaceAlias: usage.namespaceAlias,
    definitionId: usage.definitionId,
  };
}

describe('source index semantic project bootstrap', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => fse.remove(rootPath)));
  });

  test('loads analyzable files from snapshot root with semantic alias resolution', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-project-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fse.ensureDir(path.join(rootPath, 'dist'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['src/*'],
            },
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'app.ts'),
      'import type { User } from "@/types/model";\nconst value: User = { id: "u-1" };\nexport { value };\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'view.tsx'), 'export function View() { return <div />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'readme.md'), '# ignored\n');
    await fs.writeFile(path.join(rootPath, 'dist', 'bundle.ts'), 'export const built = true;\n');

    const semanticProject = await createSemanticProject(rootPath);
    const filePaths = semanticProject.sourceFiles.map((sourceFile) =>
      sourceFile.getFilePath().split(path.sep).join('/'),
    );
    const relativePaths = semanticProject.sourceFileEntries.map((entry) => entry.relativePath);

    expect(filePaths).toContain(path.join(rootPath, 'src', 'app.ts').split(path.sep).join('/'));
    expect(filePaths).toContain(path.join(rootPath, 'src', 'view.tsx').split(path.sep).join('/'));
    expect(relativePaths).toContain('src/app.ts');
    expect(relativePaths).toContain('src/types/model.ts');
    expect(filePaths).not.toContain(path.join(rootPath, 'src', 'readme.md').split(path.sep).join('/'));
    expect(filePaths).not.toContain(path.join(rootPath, 'dist', 'bundle.ts').split(path.sep).join('/'));
    expect(semanticProject.configPath).toBe(path.join(rootPath, 'tsconfig.json'));
    expect(semanticProject.warnings).toEqual([]);
    expect(semanticProject.checker).toBeTruthy();

    const appFile = semanticProject.sourceFileEntries.find((entry) => entry.relativePath === 'src/app.ts')?.sourceFile;
    expect(appFile).toBeTruthy();

    const typeRef = appFile?.getFirstDescendantByKind(SyntaxKind.TypeReference);
    expect(typeRef).toBeTruthy();

    const rawSymbol = typeRef ? semanticProject.checker.getSymbolAtLocation(typeRef.getTypeName()) : undefined;
    const userSymbol = unwrapAliasedSymbol(rawSymbol);
    expect(userSymbol?.getName()).toBe('User');

    const declarationPath = userSymbol
      ?.getDeclarations()
      .at(0)
      ?.getSourceFile()
      .getFilePath()
      .split(path.sep)
      .join('/');
    expect(declarationPath).toBe(path.join(rootPath, 'src', 'types', 'model.ts').split(path.sep).join('/'));
  });

  test('loads local declaration files into the semantic project', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-project-dts-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'types', 'globals.d.ts'),
      'export interface DeclaredUser { id: string }\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.ts'),
      'import type { DeclaredUser } from "./types/globals";\n' +
        'const user: DeclaredUser = { id: "u-1" };\n' +
        'export { user };\n',
    );

    const semanticProject = await createSemanticProject(rootPath);

    expect(semanticProject.sourceFileEntries.map((entry) => entry.relativePath)).toEqual([
      'src/consumer.ts',
      'src/types/globals.d.ts',
    ]);
  });

  test('indexes semantic definitions with export metadata', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-builder-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src', 'components'));
    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            jsx: 'preserve',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'Button.tsx'), 'export function Button() { return <button />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'Card.tsx'), 'export default function Card() { return <section />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'Foo.tsx'), 'export function Foo() { return <main />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'barrel.ts'), 'export { Foo as Bar } from "./Foo";\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'components', 'wrapped.tsx'),
      'import { memo } from "react";\n' +
        'export const MemoPanel = memo(function MemoPanel() { return <section />; });\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'anonymous-default.tsx'), 'export default () => <div />;\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'widget.tsx'), 'export function widget() { return <aside />; }\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'hooks.ts'),
      'export function useSession() { return { id: "s-1" }; }\n' +
        'export const useFeatureFlag = true;\n' +
        'export const useFeatureData = () => "ok";\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'types', 'model.ts'),
      'export interface User { id: string }\n' + 'export type UserId = string;\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 77);

    const buttonDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Button' && definition.file === 'src/components/Button.tsx',
    );
    const cardDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Card' && definition.file === 'src/components/Card.tsx',
    );
    const fooDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Foo' && definition.file === 'src/components/Foo.tsx',
    );
    const barDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Bar' && definition.file === 'src/components/barrel.ts',
    );
    const memoPanelDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'MemoPanel' && definition.file === 'src/components/wrapped.tsx',
    );
    const widgetDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'widget' && definition.file === 'src/components/widget.tsx',
    );
    const useSessionDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'useSession' && definition.file === 'src/hooks.ts',
    );
    const useFeatureFlagDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'useFeatureFlag' && definition.file === 'src/hooks.ts',
    );
    const useFeatureDataDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'useFeatureData' && definition.file === 'src/hooks.ts',
    );
    const anonymousDefaultDefinition = artifact.definitions?.find(
      (definition) =>
        definition.file === 'src/components/anonymous-default.tsx' &&
        definition.name === 'AnonymousDefault' &&
        definition.isDefaultExport,
    );
    const userDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'User' && definition.file === 'src/types/model.ts',
    );
    const userIdDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'UserId' && definition.file === 'src/types/model.ts',
    );

    expect(buttonDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['Button'],
      isDefaultExport: false,
    });
    expect(cardDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['default'],
      isDefaultExport: true,
    });
    expect(fooDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['Foo'],
      isDefaultExport: false,
    });
    expect(barDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['Bar'],
      isDefaultExport: false,
      line: 1,
      filePath: 'src/components/Foo.tsx',
    });
    expect(barDefinition?.exportedAs).toContain('Bar');
    expect(barDefinition?.exportedAs).toContain('Foo');
    expect(fooDefinition?.id).not.toBe(barDefinition?.id);
    expect(memoPanelDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['MemoPanel'],
      isDefaultExport: false,
    });
    expect(widgetDefinition).toMatchObject({
      kind: 'function',
      exportNames: ['widget'],
      isDefaultExport: false,
    });
    expect(useSessionDefinition).toMatchObject({
      kind: 'hook',
      exportNames: ['useSession'],
      isDefaultExport: false,
    });
    expect(useFeatureFlagDefinition).toMatchObject({
      kind: 'constant',
      exportNames: ['useFeatureFlag'],
      isDefaultExport: false,
    });
    expect(useFeatureDataDefinition).toMatchObject({
      kind: 'hook',
      exportNames: ['useFeatureData'],
      isDefaultExport: false,
    });
    expect(anonymousDefaultDefinition).toMatchObject({
      kind: 'component',
      exportNames: ['default'],
      isDefaultExport: true,
      filePath: 'src/components/anonymous-default.tsx',
    });
    expect(userDefinition).toMatchObject({
      kind: 'interface',
      exportNames: ['User'],
      isDefaultExport: false,
    });
    expect(userIdDefinition).toMatchObject({
      kind: 'type',
      exportNames: ['UserId'],
      isDefaultExport: false,
    });
    expect((artifact.usages ?? []).map(pickUsageFields)).toEqual([
      {
        kind: 're-export',
        file: 'src/components/barrel.ts',
        symbol: 'Bar',
        targetFile: 'src/components/Foo.tsx',
        line: 1,
        importedAs: 'Foo',
        namespaceAlias: undefined,
        definitionId: fooDefinition?.id,
      },
    ]);
    expect(artifact.definitions.every((definition) => !('definitionId' in definition))).toBe(true);
    expect(
      artifact.usages.every((usage) => !('fromFilePath' in usage) && !('toFilePath' in usage)),
    ).toBe(true);
  });

  test('indexes semantic usages across defaults, barrels, aliases, namespaces, and types', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-usages-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src', 'components'));
    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            jsx: 'preserve',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'Button.tsx'), 'export default function Button() { return <button />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'Widget.tsx'), 'export function Widget() { return <section />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'components', 'index.ts'), 'export { Widget } from "./Widget";\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'components', 'import-then-export.ts'),
      'import { Widget } from "./Widget";\nexport { Widget };\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'components', 'aliased.ts'),
      'import { Widget as InnerWidget } from "./Widget";\nexport { InnerWidget as FancyWidget };\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'types', 'default-user.ts'), 'export default interface DefaultUser { id: string }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'types', 'shared.ts'), 'export interface SharedUser { id: string }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'types', 'index.ts'), 'export * from "./shared";\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.tsx'),
      'import Button from "./components/Button";\n' +
        'import { Widget } from "./components/index";\n' +
        'import { Widget as ImportedThenExportedWidget } from "./components/import-then-export";\n' +
        'import { FancyWidget } from "./components/aliased";\n' +
      'import * as Components from "./components/index";\n' +
      'import type DefaultUser from "./types/default-user";\n' +
      'import type { SharedUser } from "./types";\n' +
      'import * as Models from "./types";\n' +
      'import type * as TypedModels from "./types";\n' +
      'const directUser: DefaultUser = { id: "u-1" };\n' +
      'const sharedUser: SharedUser = { id: "u-2" };\n' +
      'const namespacedUser: Models.SharedUser = { id: "u-3" };\n' +
      'const typedNamespacedUser: TypedModels.SharedUser = { id: "u-4" };\n' +
      'const NamespaceWidget = Components.Widget;\n' +
      'export function App() {\n' +
        '  void directUser;\n' +
        '  void sharedUser;\n' +
        '  void namespacedUser;\n' +
        '  void typedNamespacedUser;\n' +
        '  void NamespaceWidget;\n' +
        '  return <>\n' +
        '    <Button />\n' +
        '    <Widget />\n' +
        '    <ImportedThenExportedWidget />\n' +
        '    <FancyWidget />\n' +
        '  </>;\n' +
        '}\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 88);

    const buttonDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Button' && definition.file === 'src/components/Button.tsx' && definition.isDefaultExport,
    );
    const widgetBarrelDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Widget' && definition.file === 'src/components/index.ts',
    );
    const importedThenExportedDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Widget' && definition.file === 'src/components/import-then-export.ts',
    );
    const fancyWidgetDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'FancyWidget' && definition.file === 'src/components/aliased.ts',
    );
    const defaultUserDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'DefaultUser' && definition.file === 'src/types/default-user.ts' && definition.isDefaultExport,
    );
    const sharedUserDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'SharedUser' && definition.file === 'src/types/index.ts',
    );

    expect(buttonDefinition).toBeTruthy();
    expect(widgetBarrelDefinition).toBeTruthy();
    expect(importedThenExportedDefinition).toBeTruthy();
    expect(fancyWidgetDefinition).toBeTruthy();
    expect(defaultUserDefinition).toBeTruthy();
    expect(sharedUserDefinition).toBeTruthy();
    expect(widgetBarrelDefinition).toMatchObject({ line: 1, filePath: 'src/components/Widget.tsx' });
    expect(importedThenExportedDefinition).toMatchObject({ line: 2, filePath: 'src/components/Widget.tsx' });
    expect(fancyWidgetDefinition).toMatchObject({ line: 2, filePath: 'src/components/Widget.tsx' });
    expect(sharedUserDefinition).toMatchObject({ line: 1, filePath: 'src/types/shared.ts' });
    const consumerUsages = (artifact.usages ?? [])
      .filter((usage) => usage.file === 'src/consumer.tsx')
      .map(pickUsageFields);

    expect(consumerUsages).toEqual([
      {
        kind: 'type-import',
        file: 'src/consumer.tsx',
        symbol: 'DefaultUser',
        targetFile: 'src/types/default-user.ts',
        line: 6,
        importedAs: 'DefaultUser',
        namespaceAlias: undefined,
        definitionId: defaultUserDefinition?.id,
      },
      {
        kind: 'type-import',
        file: 'src/consumer.tsx',
        symbol: 'SharedUser',
        targetFile: 'src/types/index.ts',
        line: 7,
        importedAs: 'SharedUser',
        namespaceAlias: undefined,
        definitionId: sharedUserDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.tsx',
        symbol: 'DefaultUser',
        targetFile: 'src/types/default-user.ts',
        line: 10,
        importedAs: 'DefaultUser',
        namespaceAlias: undefined,
        definitionId: defaultUserDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.tsx',
        symbol: 'SharedUser',
        targetFile: 'src/types/index.ts',
        line: 11,
        importedAs: 'SharedUser',
        namespaceAlias: undefined,
        definitionId: sharedUserDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.tsx',
        symbol: 'SharedUser',
        targetFile: 'src/types/index.ts',
        line: 12,
        importedAs: undefined,
        namespaceAlias: 'Models',
        definitionId: sharedUserDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.tsx',
        symbol: 'SharedUser',
        targetFile: 'src/types/index.ts',
        line: 13,
        importedAs: undefined,
        namespaceAlias: 'TypedModels',
        definitionId: sharedUserDefinition?.id,
      },
      {
        kind: 'reference',
        file: 'src/consumer.tsx',
        symbol: 'Widget',
        targetFile: 'src/components/index.ts',
        line: 14,
        importedAs: undefined,
        namespaceAlias: 'Components',
        definitionId: widgetBarrelDefinition?.id,
      },
      {
        kind: 'jsx',
        file: 'src/consumer.tsx',
        symbol: 'Button',
        targetFile: 'src/components/Button.tsx',
        line: 22,
        importedAs: 'Button',
        namespaceAlias: undefined,
        definitionId: buttonDefinition?.id,
      },
      {
        kind: 'jsx',
        file: 'src/consumer.tsx',
        symbol: 'Widget',
        targetFile: 'src/components/index.ts',
        line: 23,
        importedAs: 'Widget',
        namespaceAlias: undefined,
        definitionId: widgetBarrelDefinition?.id,
      },
      {
        kind: 'jsx',
        file: 'src/consumer.tsx',
        symbol: 'ImportedThenExportedWidget',
        targetFile: 'src/components/import-then-export.ts',
        line: 24,
        importedAs: 'ImportedThenExportedWidget',
        namespaceAlias: undefined,
        definitionId: importedThenExportedDefinition?.id,
      },
      {
        kind: 'jsx',
        file: 'src/consumer.tsx',
        symbol: 'FancyWidget',
        targetFile: 'src/components/aliased.ts',
        line: 25,
        importedAs: 'FancyWidget',
        namespaceAlias: undefined,
        definitionId: fancyWidgetDefinition?.id,
      },
    ]);
  });

  test('indexes semantic definitions and usages for local declaration files', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-dts-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'types', 'contracts.d.ts'),
      'export interface ButtonContract { label: string }\n' +
        'export type ButtonState = "idle" | "busy";\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.ts'),
      'import type { ButtonContract, ButtonState } from "./types/contracts";\n' +
        'const contract: ButtonContract = { label: "Launch" };\n' +
        'const state: ButtonState = "idle";\n' +
        'export { contract, state };\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 96);

    const buttonContractDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'ButtonContract' && definition.file === 'src/types/contracts.d.ts',
    );
    const buttonStateDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'ButtonState' && definition.file === 'src/types/contracts.d.ts',
    );

    expect(buttonContractDefinition).toMatchObject({
      kind: 'interface',
      exportNames: ['ButtonContract'],
      isDefaultExport: false,
      filePath: 'src/types/contracts.d.ts',
    });
    expect(buttonStateDefinition).toMatchObject({
      kind: 'type',
      exportNames: ['ButtonState'],
      isDefaultExport: false,
      filePath: 'src/types/contracts.d.ts',
    });
    expect(
      artifact.files.find((file) => file.path === 'src/types/contracts.d.ts'),
    ).toMatchObject({
      path: 'src/types/contracts.d.ts',
      ext: '.ts',
      imports: [],
      localDependencies: [],
    });
    expect(
      (artifact.usages ?? [])
        .filter((usage) => usage.file === 'src/consumer.ts')
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 'type-import',
        file: 'src/consumer.ts',
        symbol: 'ButtonContract',
        targetFile: 'src/types/contracts.d.ts',
        line: 1,
        importedAs: 'ButtonContract',
        namespaceAlias: undefined,
        definitionId: buttonContractDefinition?.id,
      },
      {
        kind: 'type-import',
        file: 'src/consumer.ts',
        symbol: 'ButtonState',
        targetFile: 'src/types/contracts.d.ts',
        line: 1,
        importedAs: 'ButtonState',
        namespaceAlias: undefined,
        definitionId: buttonStateDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.ts',
        symbol: 'ButtonContract',
        targetFile: 'src/types/contracts.d.ts',
        line: 2,
        importedAs: 'ButtonContract',
        namespaceAlias: undefined,
        definitionId: buttonContractDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.ts',
        symbol: 'ButtonState',
        targetFile: 'src/types/contracts.d.ts',
        line: 3,
        importedAs: 'ButtonState',
        namespaceAlias: undefined,
        definitionId: buttonStateDefinition?.id,
      },
    ]);
  });

  test('emits lightweight file metadata from semantic module resolution', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-file-metadata-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src', 'components'));
    await fse.ensureDir(path.join(rootPath, 'src', 'types'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: 'src',
            paths: {
              '@/*': ['*'],
            },
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'types', 'model.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'components', 'Button.tsx'),
      'import type { User } from "types/model";\n' +
        'export const Button = (_props: { user?: User }) => <button />;\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'feature.tsx'),
      'import { Button } from "@/components/Button";\n' +
        'import type { User } from "@/types/model";\n' +
        'const users: User[] = [];\n' +
        'export function Feature() { return <Button user={users[0]} />; }\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'barrel.ts'), 'export { Button } from "./components/Button";\n');

    const artifact = await buildSourceIndexArtifact(rootPath, 94);

    expect(artifact.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/components/Button.tsx',
          ext: '.tsx',
          imports: ['types/model'],
          localDependencies: ['src/types/model.ts'],
        }),
        expect.objectContaining({
          path: 'src/feature.tsx',
          ext: '.tsx',
          imports: ['@/components/Button', '@/types/model'],
          localDependencies: ['src/components/Button.tsx', 'src/types/model.ts'],
        }),
        expect.objectContaining({
          path: 'src/barrel.ts',
          ext: '.ts',
          imports: ['./components/Button'],
          localDependencies: ['src/components/Button.tsx'],
        }),
      ]),
    );

    for (const file of artifact.files) {
      expect(file).not.toHaveProperty('exports');
      expect(file).not.toHaveProperty('importEntries');
      expect(file).not.toHaveProperty('reExportEntries');
      expect(file).not.toHaveProperty('symbols');
    }
    for (const definition of artifact.definitions) {
      expect(definition).not.toHaveProperty('definitionId');
    }
    for (const usage of artifact.usages) {
      expect(usage).not.toHaveProperty('fromFilePath');
      expect(usage).not.toHaveProperty('toFilePath');
    }
  });

  test('resolves merged exports and qualified namespace type usages to the right definitions', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-merged-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'merged.ts'),
      'export class Foo {}\n' +
        'export namespace Foo { export interface Meta { value: string } }\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'models.ts'), 'export interface User { id: string }\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.ts'),
      'import { Foo } from "./merged";\n' +
        'import * as models from "./models";\n' +
        'import type * as typedModels from "./models";\n' +
        'const value = new Foo();\n' +
        'type RuntimeQualifiedUser = models.User;\n' +
        'type TypeQualifiedUser = typedModels.User;\n' +
        'export { value };\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 89);

    const fooClassDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Foo' && definition.file === 'src/merged.ts' && definition.kind === 'class',
    );
    const fooNamespaceDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Foo' && definition.file === 'src/merged.ts' && definition.kind === 'namespace',
    );
    const userDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'User' && definition.file === 'src/models.ts' && definition.kind === 'interface',
    );

    expect(fooClassDefinition).toBeTruthy();
    expect(fooNamespaceDefinition).toBeTruthy();
    expect(userDefinition).toBeTruthy();

    const consumerUsages = (artifact.usages ?? [])
      .filter((usage) => usage.file === 'src/consumer.ts')
      .map(pickUsageFields);

    expect(consumerUsages).toEqual([
      {
        kind: 'reference',
        file: 'src/consumer.ts',
        symbol: 'Foo',
        targetFile: 'src/merged.ts',
        line: 4,
        importedAs: 'Foo',
        namespaceAlias: undefined,
        definitionId: fooClassDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.ts',
        symbol: 'User',
        targetFile: 'src/models.ts',
        line: 5,
        importedAs: undefined,
        namespaceAlias: 'models',
        definitionId: userDefinition?.id,
      },
      {
        kind: 'type-reference',
        file: 'src/consumer.ts',
        symbol: 'User',
        targetFile: 'src/models.ts',
        line: 6,
        importedAs: undefined,
        namespaceAlias: 'typedModels',
        definitionId: userDefinition?.id,
      },
    ]);
  });

  test('emits re-export usage edges for barrel files', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-reexports-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'Foo.tsx'), 'export function Foo() { return <div />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'direct-barrel.ts'), 'export { Foo } from "./Foo";\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'import-then-export-barrel.ts'),
      'import { Foo } from "./Foo";\nexport { Foo };\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 90);

    const fooDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Foo' && definition.file === 'src/Foo.tsx',
    );

    expect(fooDefinition).toBeTruthy();
    expect(
      (artifact.usages ?? [])
        .filter((usage) => usage.kind === 're-export')
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 're-export',
        file: 'src/direct-barrel.ts',
        symbol: 'Foo',
        targetFile: 'src/Foo.tsx',
        line: 1,
        importedAs: 'Foo',
        namespaceAlias: undefined,
        definitionId: fooDefinition?.id,
      },
      {
        kind: 're-export',
        file: 'src/import-then-export-barrel.ts',
        symbol: 'Foo',
        targetFile: 'src/Foo.tsx',
        line: 2,
        importedAs: 'Foo',
        namespaceAlias: undefined,
        definitionId: fooDefinition?.id,
      },
    ]);
  });

  test('emits re-export usage edges for wildcard and namespace barrels', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-wildcard-reexports-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'shared.ts'),
      'export interface SharedUser { id: string }\n' +
        'export function SharedWidget() { return "ok"; }\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'wildcard-barrel.ts'), 'export * from "./shared";\n');
    await fs.writeFile(path.join(rootPath, 'src', 'namespace-barrel.ts'), 'export * as shared from "./shared";\n');

    const artifact = await buildSourceIndexArtifact(rootPath, 92);

    const sharedUserDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'SharedUser' && definition.file === 'src/shared.ts',
    );
    const sharedWidgetDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'SharedWidget' && definition.file === 'src/shared.ts',
    );

    expect(sharedUserDefinition).toBeTruthy();
    expect(sharedWidgetDefinition).toBeTruthy();
    expect(
      (artifact.usages ?? [])
        .filter(
          (usage) =>
            usage.file === 'src/wildcard-barrel.ts' || usage.file === 'src/namespace-barrel.ts',
        )
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 're-export',
        file: 'src/namespace-barrel.ts',
        symbol: 'shared',
        targetFile: 'src/shared.ts',
        line: 1,
        importedAs: 'shared',
        namespaceAlias: undefined,
        definitionId: null,
      },
      {
        kind: 're-export',
        file: 'src/wildcard-barrel.ts',
        symbol: 'SharedUser',
        targetFile: 'src/shared.ts',
        line: 1,
        importedAs: 'SharedUser',
        namespaceAlias: undefined,
        definitionId: sharedUserDefinition?.id,
      },
      {
        kind: 're-export',
        file: 'src/wildcard-barrel.ts',
        symbol: 'SharedWidget',
        targetFile: 'src/shared.ts',
        line: 1,
        importedAs: 'SharedWidget',
        namespaceAlias: undefined,
        definitionId: sharedWidgetDefinition?.id,
      },
    ]);
  });

  test('resolves downstream jsx consumers through namespace re-export barrels', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-namespace-consumers-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            jsx: 'preserve',
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(path.join(rootPath, 'src', 'shared.tsx'), 'export function SharedWidget() { return <div />; }\n');
    await fs.writeFile(path.join(rootPath, 'src', 'namespace-barrel.ts'), 'export * as shared from "./shared";\n');
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.tsx'),
      'import { shared } from "./namespace-barrel";\n' +
        'export function App() { return <shared.SharedWidget />; }\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 95);

    const sharedNamespaceDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'shared' && definition.file === 'src/namespace-barrel.ts',
    );
    const sharedWidgetDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'SharedWidget' && definition.file === 'src/shared.tsx',
    );

    expect(sharedNamespaceDefinition).toMatchObject({
      kind: 'namespace',
      exportNames: ['shared'],
      isDefaultExport: false,
      line: 1,
      filePath: 'src/shared.tsx',
    });
    expect(sharedWidgetDefinition).toBeTruthy();
    expect(
      (artifact.usages ?? [])
        .filter((usage) => usage.file === 'src/consumer.tsx')
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 'jsx',
        file: 'src/consumer.tsx',
        symbol: 'SharedWidget',
        targetFile: 'src/shared.tsx',
        line: 2,
        importedAs: undefined,
        namespaceAlias: 'shared',
        definitionId: sharedWidgetDefinition?.id,
      },
    ]);
  });

  test('filters runtime symbols from type-only wildcard re-export edges', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-type-wildcard-reexports-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'shared.ts'),
      'export interface SharedUser { id: string }\n' +
        'export function SharedWidget() { return "ok"; }\n',
    );
    await fs.writeFile(path.join(rootPath, 'src', 'type-barrel.ts'), 'export type * from "./shared";\n');

    const artifact = await buildSourceIndexArtifact(rootPath, 93);

    const sharedUserDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'SharedUser' && definition.file === 'src/shared.ts',
    );

    expect(sharedUserDefinition).toBeTruthy();
    expect(
      (artifact.usages ?? [])
        .filter((usage) => usage.file === 'src/type-barrel.ts')
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 're-export',
        file: 'src/type-barrel.ts',
        symbol: 'SharedUser',
        targetFile: 'src/shared.ts',
        line: 1,
        importedAs: 'SharedUser',
        namespaceAlias: undefined,
        definitionId: sharedUserDefinition?.id,
      },
    ]);
  });

  test('classifies keyof typeof references as type-position usages', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'source-index-semantic-typeof-'));
    tempRoots.push(rootPath);

    await fse.ensureDir(path.join(rootPath, 'src'));
    await fs.writeFile(
      path.join(rootPath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'theme.ts'),
      'export const Colors = { primary: "#000", accent: "#fff" } as const;\n',
    );
    await fs.writeFile(
      path.join(rootPath, 'src', 'consumer.ts'),
      'import { Colors } from "./theme";\n' +
        'type ThemeColor = keyof typeof Colors;\n' +
        'export type { ThemeColor };\n',
    );

    const artifact = await buildSourceIndexArtifact(rootPath, 91);

    const colorsDefinition = artifact.definitions?.find(
      (definition) => definition.name === 'Colors' && definition.file === 'src/theme.ts',
    );

    expect(colorsDefinition).toBeTruthy();
    expect(
      (artifact.usages ?? [])
        .filter((usage) => usage.file === 'src/consumer.ts')
        .map(pickUsageFields),
    ).toEqual([
      {
        kind: 'type-reference',
        file: 'src/consumer.ts',
        symbol: 'Colors',
        targetFile: 'src/theme.ts',
        line: 2,
        importedAs: 'Colors',
        namespaceAlias: undefined,
        definitionId: colorsDefinition?.id,
      },
    ]);
  });
});
