export const SOURCE_INDEX_ARTIFACT_KEY = 'source-tree-v2';
export const MAX_SEARCH_RESULTS = 50;
export const MAX_CONTEXT_LINES = 10;
export const MAX_SEARCH_FILE_BYTES = 128 * 1024;

export type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';

export type SourceIndexDefinition = {
  id: string;
  name: string;
  kind:
    | 'component'
    | 'hook'
    | 'function'
    | 'class'
    | 'constant'
    | 'type'
    | 'interface'
    | 'enum'
    | 'namespace';
  file: string;
  line: number;
  exportNames: string[];
  isDefaultExport: boolean;
  signature?: string;
  doc?: string;
  tags?: string[];
  filePath?: string;
  exportedAs?: string[];
};

export type SourceIndexUsage = {
  kind: 'import' | 'type-import' | 'type-reference' | 'call' | 'jsx' | 'extends' | 'implements' | 'reference' | 're-export';
  definitionId: string | null;
  file: string;
  symbol: string;
  targetFile: string | null;
  line: number;
  importedAs?: string;
  namespaceAlias?: string;
};

export type SourceIndexFileEntry = {
  path: string;
  size: number;
  ext: string;
  imports: string[];
  localDependencies: string[];
};

export type SourceIndexArtifact = {
  format: typeof SOURCE_INDEX_ARTIFACT_KEY;
  snapshotVersionId: number;
  generatedAt: string;
  summary: {
    fileCount: number;
    totalBytes: number;
    frameworkHints: string[];
    routingMode: 'next-app-router' | 'next-pages-router' | 'react-router' | 'app-tsx-state' | 'unknown';
    warnings: string[];
    languages?: Record<string, number>;
  };
  files: SourceIndexFileEntry[];
  definitions: SourceIndexDefinition[];
  usages: SourceIndexUsage[];
};

export function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

export function isProbablyText(buffer: Buffer) {
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      return false;
    }
  }

  return true;
}
