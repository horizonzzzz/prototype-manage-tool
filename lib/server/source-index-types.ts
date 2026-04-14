export const SOURCE_INDEX_ARTIFACT_KEY = 'source-tree-v1';
export const MAX_SEARCH_RESULTS = 50;
export const MAX_CONTEXT_LINES = 10;
export const MAX_SEARCH_FILE_BYTES = 128 * 1024;

export type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';

export type IndexedComponentCandidate = {
  name: string;
  line: number;
};

export type IndexedTypeCandidate = {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
};

export type SourceIndexFileEntry = {
  path: string;
  size: number;
  ext: string;
  imports: string[];
  exports: string[];
  localDependencies: string[];
  symbols: {
    components: IndexedComponentCandidate[];
    types: IndexedTypeCandidate[];
  };
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
