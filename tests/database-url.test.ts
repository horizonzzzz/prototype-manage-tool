import { describe, expect, test } from 'vitest';

import { buildDefaultDatabaseUrl } from '@/lib/config';

describe('buildDefaultDatabaseUrl', () => {
  test('falls back to the local sqlite file under data/sqlite', () => {
    const url = buildDefaultDatabaseUrl('C:/work/product-preview-mvp');

    expect(url).toBe('file:../data/sqlite/app.db');
  });
});
