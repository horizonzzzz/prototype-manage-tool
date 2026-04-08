import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { ensureChildPath, ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import { createBuildJob } from '@/lib/server/build-job-service';
import { deleteSourceSnapshotForVersion, deleteSourceSnapshotsForProduct } from '@/lib/server/source-snapshot-service';

type UploadInput = {
  productKey: string;
  version: string;
  title?: string;
  remark?: string;
  fileName: string;
  fileSize: number;
  buffer: Buffer;
};

type VersionDownloadabilityMap = Record<string, boolean>;

type VersionSourceArchive = {
  fileName: string;
  filePath: string;
};

function createDisabledDownloadabilityMap(versions: string[]): VersionDownloadabilityMap {
  return Object.fromEntries(versions.map((version) => [version, false]));
}

function isUploadRecordCompatibilityError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeCode = 'code' in error ? error.code : undefined;
  if (maybeCode === 'P2022') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /sourcearchivepath|workspacepath|publishedpath|no such column|does not exist/i.test(error.message);
}

export async function setDefaultVersion(versionId: number) {
  const version = await prisma.productVersion.findUnique({ where: { id: versionId } });
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.status !== 'published') {
    throw new Error('Only published versions can be set as default');
  }

  await prisma.$transaction([
    prisma.productVersion.updateMany({
      where: { productId: version.productId, NOT: { id: version.id } },
      data: { isDefault: false },
    }),
    prisma.productVersion.update({
      where: { id: version.id },
      data: { isDefault: true, status: 'published' },
    }),
  ]);
}

export async function setVersionOffline(versionId: number) {
  const version = await prisma.productVersion.findUnique({ where: { id: versionId } });
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.status !== 'published') {
    throw new Error('Only published versions can be taken offline');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.productVersion.update({
      where: { id: version.id },
      data: { status: 'offline', isDefault: false },
    });

    const nextDefault = await transaction.productVersion.findFirst({
      where: { productId: version.productId, status: 'published' },
      orderBy: { createdAt: 'desc' },
    });

    if (nextDefault) {
      await transaction.productVersion.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  });
}

export async function deleteVersion(versionId: number) {
  const version = await prisma.productVersion.findUnique({
    where: { id: versionId },
    include: { product: true },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.productVersion.delete({ where: { id: versionId } });

    const nextDefault = await transaction.productVersion.findFirst({
      where: { productId: version.productId, status: 'published' },
      orderBy: { createdAt: 'desc' },
    });

    if (nextDefault) {
      await transaction.productVersion.update({
        where: { id: nextDefault.id },
        data: { isDefault: true },
      });
    }
  });

  const targetDir = ensureVersionPathInsideRoot(appConfig.prototypesDir, version.product.key, version.version);
  await fse.remove(targetDir);
  await deleteSourceSnapshotForVersion(version.product.key, version.version);
}

export async function deleteProduct(productKey: string) {
  const product = await prisma.product.findUnique({
    where: { key: productKey },
    include: { versions: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.uploadRecord.deleteMany({
      where: { productKey },
    });

    await transaction.product.delete({
      where: { key: productKey },
    });
  });

  const targetDir = ensureChildPath(appConfig.prototypesDir, productKey);
  await fse.remove(targetDir);
  await deleteSourceSnapshotsForProduct(productKey);
}

export async function processPrototypeUpload(input: UploadInput) {
  return await createBuildJob(input);
}

export async function getVersionDownloadabilityMap(productKey: string, versions: string[]) {
  if (!versions.length) {
    return {};
  }

  const downloadabilityMap = createDisabledDownloadabilityMap(versions);

  let records: Array<{ version: string; sourceArchivePath: string | null }> = [];
  try {
    records = await prisma.uploadRecord.findMany({
      where: {
        productKey,
        version: { in: versions },
        status: 'success',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        version: true,
        sourceArchivePath: true,
      },
    });
  } catch (error) {
    if (isUploadRecordCompatibilityError(error)) {
      return downloadabilityMap;
    }

    throw error;
  }

  const latestArchivePathByVersion = new Map<string, string | null>();
  for (const record of records) {
    if (!latestArchivePathByVersion.has(record.version)) {
      latestArchivePathByVersion.set(record.version, record.sourceArchivePath);
    }
  }

  await Promise.all(
    versions.map(async (version) => {
      const sourceArchivePath = latestArchivePathByVersion.get(version);
      if (!sourceArchivePath) {
        return;
      }

      downloadabilityMap[version] = await fse.pathExists(sourceArchivePath);
    }),
  );

  return downloadabilityMap;
}

export async function getVersionSourceArchive(versionId: number): Promise<VersionSourceArchive | null> {
  const version = await prisma.productVersion.findUnique({
    where: { id: versionId },
    include: {
      product: {
        select: { key: true },
      },
    },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  let record: { fileName: string; sourceArchivePath: string | null } | null = null;
  try {
    record = await prisma.uploadRecord.findFirst({
      where: {
        productKey: version.product.key,
        version: version.version,
        status: 'success',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        fileName: true,
        sourceArchivePath: true,
      },
    });
  } catch (error) {
    if (isUploadRecordCompatibilityError(error)) {
      return null;
    }

    throw error;
  }

  if (!record?.sourceArchivePath) {
    return null;
  }

  if (!(await fse.pathExists(record.sourceArchivePath))) {
    return null;
  }

  return {
    fileName: record.fileName,
    filePath: record.sourceArchivePath,
  };
}
