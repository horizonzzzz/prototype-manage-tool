import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { ensureChildPath, ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';

describe('ensureVersionPathInsideRoot', () => {
  test('returns version directory within product root', () => {
    const root = path.resolve('data/prototypes');
    const safePath = ensureVersionPathInsideRoot(root, 'crm', 'v1.0.0');

    expect(safePath.startsWith(root)).toBe(true);
  });

  test('rejects path traversal attempts', () => {
    const root = path.resolve('data/prototypes');

    expect(() => ensureVersionPathInsideRoot(root, '..', 'v1.0.0')).toThrow('Invalid product key');
    expect(() => ensureVersionPathInsideRoot(root, 'crm', '../v1.0.0')).toThrow('Invalid version');
  });

  test('rejects sibling paths that only share the same prefix', () => {
    const root = path.resolve('data/source-snapshots/user-1/crm/v1');

    expect(() => ensureChildPath(root, '../v10/src/index.ts')).toThrow('Resolved child path escapes root directory');
  });
});
