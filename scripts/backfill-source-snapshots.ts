import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { extractZipToTemp, findFileRoot } from '@/lib/server/fs-utils';
import { createSourceSnapshot } from '@/lib/server/source-snapshot-service';
import { getVersionSourceArchive } from '@/lib/server/upload-service';

type BackfillSummary = {
  scanned: number;
  skippedReady: number;
  skippedMissingArchive: number;
  skippedMissingProjectRoot: number;
  generated: number;
  failed: number;
};

type BackfillLogger = Pick<Console, 'info' | 'warn' | 'error'>;

export async function backfillSourceSnapshots(logger: BackfillLogger = console): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    scanned: 0,
    skippedReady: 0,
    skippedMissingArchive: 0,
    skippedMissingProjectRoot: 0,
    generated: 0,
    failed: 0,
  };

  const versions = await prisma.productVersion.findMany({
    where: { status: 'published' },
    include: {
      product: {
        select: { key: true },
      },
      sourceSnapshot: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  await fse.ensureDir(appConfig.uploadsTempDir);

  for (const version of versions) {
    summary.scanned += 1;

    if (version.sourceSnapshot?.status === 'ready') {
      summary.skippedReady += 1;
      continue;
    }

    let tempDir: string | null = null;

    try {
      const archive = await getVersionSourceArchive(version.id);
      if (!archive) {
        summary.skippedMissingArchive += 1;
        continue;
      }

      tempDir = await fs.mkdtemp(path.join(appConfig.uploadsTempDir, 'source-snapshot-backfill-'));
      const extractDir = path.join(tempDir, 'extract');

      await extractZipToTemp(archive.filePath, extractDir);

      const projectRoot = await findFileRoot(extractDir, 'package.json');
      if (!projectRoot) {
        summary.skippedMissingProjectRoot += 1;
        continue;
      }

      await createSourceSnapshot({
        versionId: version.id,
        productKey: version.product.key,
        version: version.version,
        sourceDir: projectRoot,
      });
      summary.generated += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error(
        `failed to backfill source snapshot for ${version.product.key}@${version.version}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      if (tempDir) {
        await fse.remove(tempDir);
      }
    }
  }

  logger.info(`source snapshot backfill summary: ${JSON.stringify(summary)}`);
  return summary;
}

async function runCli() {
  await backfillSourceSnapshots();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
