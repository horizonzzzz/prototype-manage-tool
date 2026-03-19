import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';

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
});
