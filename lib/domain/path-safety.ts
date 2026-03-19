import path from 'node:path';

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function ensureVersionPathInsideRoot(rootDir: string, productKey: string, version: string) {
  if (!SAFE_SEGMENT.test(productKey) || productKey.includes('..')) {
    throw new Error('Invalid product key');
  }

  if (!SAFE_SEGMENT.test(version) || version.includes('..')) {
    throw new Error('Invalid version');
  }

  const resolved = path.resolve(rootDir, productKey, version);

  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Resolved path escapes root directory');
  }

  return resolved;
}

export function ensureChildPath(rootDir: string, ...segments: string[]) {
  const resolved = path.resolve(rootDir, ...segments);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Resolved child path escapes root directory');
  }
  return resolved;
}
