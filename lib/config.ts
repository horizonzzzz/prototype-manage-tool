import { createHash } from 'node:crypto';
import path from 'node:path';

export function buildDefaultDatabaseUrl(rootDir: string) {
  const prismaDir = path.join(rootDir, 'prisma');
  const sqliteFile = path.join(rootDir, 'data', 'sqlite', 'app.db');
  const relativePath = path.relative(prismaDir, sqliteFile).replace(/\\/g, '/');
  return `file:${relativePath}`;
}

export function buildDevelopmentAuthSecret(rootDir: string) {
  const digest = createHash('sha256').update(rootDir).digest('hex');
  return `dev-auth-secret-${digest}`;
}

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.DATA_DIR ?? './data');
const databaseUrl = process.env.DATABASE_URL ?? buildDefaultDatabaseUrl(rootDir);
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === 'production' ? '' : buildDevelopmentAuthSecret(rootDir));

export const appConfig = {
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  authSecret,
  mcpTokenEncryptionKey: process.env.MCP_TOKEN_ENCRYPTION_KEY ?? authSecret,
  dataDir,
  prototypesDir: path.join(dataDir, 'prototypes'),
  userAvatarsDir: path.join(dataDir, 'user-avatars'),
  sourceSnapshotsDir: path.join(dataDir, 'source-snapshots'),
  uploadsTempDir: path.join(dataDir, 'uploads-temp'),
  buildJobsDir: path.join(dataDir, 'build-jobs'),
  sqliteDir: path.join(dataDir, 'sqlite'),
  avatarMaxBytes: Number(process.env.AVATAR_MAX_MB ?? '2') * 1024 * 1024,
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_MB ?? '200') * 1024 * 1024,
  databaseUrl,
};
