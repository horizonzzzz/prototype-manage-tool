import { appConfig } from '@/lib/config';
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ??= appConfig.databaseUrl;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: appConfig.databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
