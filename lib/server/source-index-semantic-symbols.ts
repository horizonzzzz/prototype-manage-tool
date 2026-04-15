import path from 'node:path';

import type { Node, Symbol as MorphSymbol } from 'ts-morph';

import { normalizePosixPath } from '@/lib/server/code-analysis';

export function getRelativeSourcePath(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return normalizePosixPath(relative);
}

export function unwrapAliasedSymbol(symbol: MorphSymbol | undefined): MorphSymbol | undefined {
  let current = symbol;
  const seen = new Set<MorphSymbol>();

  while (current && current.isAlias()) {
    if (seen.has(current)) {
      break;
    }

    seen.add(current);
    const next = current.getAliasedSymbol();
    if (!next) {
      break;
    }
    current = next;
  }

  return current;
}

export function getNodeLine(node: Node) {
  return node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
}
