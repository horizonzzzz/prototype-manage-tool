import path from 'node:path';

import { isSafeRouteSegment } from '@/lib/domain/route-segment';

export function ensureVersionPathInsideRoot(rootDir: string, productKey: string, version: string) {
  if (!isSafeRouteSegment(productKey)) {
    throw new Error('Invalid product key');
  }

  if (!isSafeRouteSegment(version)) {
    throw new Error('Invalid version');
  }

  const resolved = path.resolve(rootDir, productKey, version);

  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Resolved path escapes root directory');
  }

  return resolved;
}

export function ensureUserVersionPathInsideRoot(rootDir: string, userId: string, productKey: string, version: string) {
  if (!isSafeRouteSegment(userId)) {
    throw new Error('Invalid user id');
  }

  return ensureChildPath(rootDir, userId, productKey, version);
}

export function ensureChildPath(rootDir: string, ...segments: string[]) {
  const resolved = path.resolve(rootDir, ...segments);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Resolved child path escapes root directory');
  }
  return resolved;
}
