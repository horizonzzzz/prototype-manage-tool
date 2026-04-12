import fs from 'node:fs';
import path from 'node:path';

import { appConfig } from '@/lib/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

process.env.DATABASE_URL ??= appConfig.databaseUrl;
fs.mkdirSync(appConfig.sqliteDir, { recursive: true });

function resolveAdapterDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice('file:'.length);

  if (!filePath || path.isAbsolute(filePath) || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return databaseUrl;
  }

  const absoluteFilePath = path.resolve(process.cwd(), 'prisma', filePath);
  return `file:${absoluteFilePath.replace(/\\/g, '/')}`;
}

const adapter = new PrismaBetterSqlite3(
  { url: resolveAdapterDatabaseUrl(appConfig.databaseUrl) },
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
