import path from 'node:path';

export function resolveSqliteFileUrl(databaseUrl: string, baseDir: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice('file:'.length);

  if (!filePath || path.isAbsolute(filePath) || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return databaseUrl;
  }

  const absoluteFilePath = path.resolve(baseDir, filePath);
  return `file:${absoluteFilePath.replace(/\\/g, '/')}`;
}
