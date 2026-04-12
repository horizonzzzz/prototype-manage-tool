import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildDefaultDatabaseUrl, buildDevelopmentAuthSecret } from '@/lib/config';

describe('buildDefaultDatabaseUrl', () => {
  test('falls back to the local sqlite file under data/sqlite', () => {
    const url = buildDefaultDatabaseUrl('C:/work/product-preview-mvp');

    expect(url).toBe('file:../data/sqlite/app.db');
  });
});

describe('buildDevelopmentAuthSecret', () => {
  test('returns a stable non-empty fallback secret for local development', () => {
    const secret = buildDevelopmentAuthSecret('C:/work/product-preview-mvp');

    expect(secret).toMatch(/^dev-auth-secret-/);
    expect(secret.length).toBeGreaterThan(20);
    expect(buildDevelopmentAuthSecret('C:/work/product-preview-mvp')).toBe(secret);
  });
});

describe('prisma.config datasource url', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
      return;
    }

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  test('resolves relative sqlite urls against the prisma directory', async () => {
    process.env.DATABASE_URL = 'file:../data/sqlite/app.db';

    const prismaConfigUrl = pathToFileURL(path.join(process.cwd(), 'prisma.config.ts')).href;
    const { default: prismaConfig } = await import(`${prismaConfigUrl}?t=${Date.now()}`);

    expect(prismaConfig.datasource.url).toBe(
      `file:${path.join(process.cwd(), 'data', 'sqlite', 'app.db').replace(/\\/g, '/')}`,
    );
  });
});
