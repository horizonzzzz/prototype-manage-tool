import fs from 'node:fs/promises';
import type { ReadStream } from 'node:fs';
import path from 'node:path';

import fse from 'fs-extra';
import yauzl from 'yauzl';

import { appConfig } from '@/lib/config';
import { ensureChildPath, ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';

export async function ensureAppDirectories() {
  await Promise.all([
    fse.ensureDir(appConfig.dataDir),
    fse.ensureDir(appConfig.prototypesDir),
    fse.ensureDir(appConfig.uploadsTempDir),
    fse.ensureDir(appConfig.sqliteDir),
  ]);
}

async function openZip(filePath: string) {
  return await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (error: Error | null, zipFile: yauzl.ZipFile | undefined) => {
      if (error || !zipFile) {
        reject(error ?? new Error('Failed to open zip file'));
        return;
      }

      resolve(zipFile);
    });
  });
}

async function extractEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry, tempDir: string) {
  const normalizedPath = entry.fileName.replace(/\\/g, '/');
  const destinationPath = ensureChildPath(tempDir, normalizedPath);

  if (/\/$/.test(normalizedPath)) {
    await fse.ensureDir(destinationPath);
    return;
  }

  await fse.ensureDir(path.dirname(destinationPath));

  await new Promise<void>((resolve, reject) => {
    zipFile.openReadStream(entry, async (error: Error | null, stream: ReadStream | undefined) => {
      if (error || !stream) {
        reject(error ?? new Error('Failed to read zip entry'));
        return;
      }

      const { createWriteStream } = await import('node:fs');
      const writeStream = createWriteStream(destinationPath);
      stream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('close', () => resolve());
      stream.pipe(writeStream);
    });
  });
}

export async function extractZipToTemp(zipPath: string, tempDir: string) {
  const zipFile = await openZip(zipPath);
  await fse.ensureDir(tempDir);

  return await new Promise<void>((resolve, reject) => {
    zipFile.readEntry();

    zipFile.on('entry', async (entry: yauzl.Entry) => {
      try {
        await extractEntry(zipFile, entry, tempDir);
        zipFile.readEntry();
      } catch (error) {
        zipFile.close();
        reject(error);
      }
    });

    zipFile.on('end', () => resolve());
    zipFile.on('error', reject);
  });
}

export async function findIndexRoot(startDir: string): Promise<string | null> {
  const entries = await fs.readdir(startDir, { withFileTypes: true });

  if (entries.some((entry) => entry.isFile() && entry.name === 'index.html')) {
    return startDir;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = await findIndexRoot(path.join(startDir, entry.name));
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export async function publishExtractedDir(productKey: string, version: string, sourceDir: string) {
  const destinationDir = ensureVersionPathInsideRoot(appConfig.prototypesDir, productKey, version);
  await fse.remove(destinationDir);
  await fse.ensureDir(path.dirname(destinationDir));
  await fse.copy(sourceDir, destinationDir, { overwrite: true });
  return destinationDir;
}
