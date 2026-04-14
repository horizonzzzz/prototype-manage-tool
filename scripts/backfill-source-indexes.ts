import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '@/lib/prisma';
import { rebuildSourceSnapshotIndex } from '@/lib/server/source-snapshot-service';

type BackfillSourceIndexesSummary = {
  scanned: number;
  skippedSnapshotNotReady: number;
  skippedIndexReady: number;
  rebuilt: number;
  failed: number;
};

type BackfillLogger = Pick<Console, 'info' | 'warn' | 'error'>;

export async function backfillSourceIndexes(logger: BackfillLogger = console): Promise<BackfillSourceIndexesSummary> {
  const summary: BackfillSourceIndexesSummary = {
    scanned: 0,
    skippedSnapshotNotReady: 0,
    skippedIndexReady: 0,
    rebuilt: 0,
    failed: 0,
  };

  const versions = await prisma.productVersion.findMany({
    where: { status: 'published' },
    include: {
      product: {
        select: { key: true },
      },
      sourceSnapshot: {
        select: {
          id: true,
          status: true,
          indexStatus: true,
          indexArtifacts: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const version of versions) {
    summary.scanned += 1;

    const snapshot = version.sourceSnapshot;
    if (!snapshot || snapshot.status !== 'ready') {
      summary.skippedSnapshotNotReady += 1;
      continue;
    }

    const hasArtifacts = snapshot.indexArtifacts.length > 0;
    if (snapshot.indexStatus === 'ready' && hasArtifacts) {
      summary.skippedIndexReady += 1;
      continue;
    }

    try {
      await rebuildSourceSnapshotIndex(version.id);
      summary.rebuilt += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error(
        `failed to backfill source index for ${version.product.key}@${version.version}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  logger.info(`source index backfill summary: ${JSON.stringify(summary)}`);
  return summary;
}

async function runCli() {
  await backfillSourceIndexes();
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
