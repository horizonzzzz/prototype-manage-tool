import fs from 'node:fs';
import path from 'node:path';

import { appConfig } from '@/lib/config';
import { resolveSqliteFileUrl } from '@/lib/sqlite-url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

process.env.DATABASE_URL ??= appConfig.databaseUrl;
fs.mkdirSync(appConfig.sqliteDir, { recursive: true });

const adapter = new PrismaBetterSqlite3(
  { url: resolveSqliteFileUrl(appConfig.databaseUrl, path.join(process.cwd(), 'prisma')) },
  { timestampFormat: 'unixepoch-ms' },
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
