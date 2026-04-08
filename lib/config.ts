import path from 'node:path';

export function buildDefaultDatabaseUrl(rootDir: string) {
  const prismaDir = path.join(rootDir, 'prisma');
  const sqliteFile = path.join(rootDir, 'data', 'sqlite', 'app.db');
  const relativePath = path.relative(prismaDir, sqliteFile).replace(/\\/g, '/');
  return `file:${relativePath}`;
}

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.DATA_DIR ?? './data');
const databaseUrl = process.env.DATABASE_URL ?? buildDefaultDatabaseUrl(rootDir);

export const appConfig = {
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  dataDir,
  prototypesDir: path.join(dataDir, 'prototypes'),
  sourceSnapshotsDir: path.join(dataDir, 'source-snapshots'),
  uploadsTempDir: path.join(dataDir, 'uploads-temp'),
  buildJobsDir: path.join(dataDir, 'build-jobs'),
  sqliteDir: path.join(dataDir, 'sqlite'),
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_MB ?? '200') * 1024 * 1024,
  mcpAuthToken: process.env.MCP_AUTH_TOKEN ?? '',
  databaseUrl,
};
