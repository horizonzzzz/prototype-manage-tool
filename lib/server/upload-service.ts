import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';
import { detectForbiddenAbsoluteReferences, normalizeUploadFileName } from '@/lib/domain/upload-validation';
import { prisma } from '@/lib/prisma';
import { ensureAppDirectories, extractZipToTemp, findIndexRoot, publishExtractedDir } from '@/lib/server/fs-utils';

type UploadInput = {
  productKey: string;
  version: string;
  title?: string;
  remark?: string;
  fileName: string;
  fileSize: number;
  buffer: Buffer;
};

function buildEntryUrl(productKey: string, version: string) {
  return `/prototypes/${productKey}/${version}/index.html`;
}

export async function setDefaultVersion(versionId: number) {
  const version = await prisma.productVersion.findUnique({ where: { id: versionId } });
  if (!version) {
    throw new Error('Version not found');
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
}

export async function processPrototypeUpload(input: UploadInput) {
  await ensureAppDirectories();

  const safeFileName = normalizeUploadFileName(input.fileName);
  const tempToken = crypto.randomUUID();
  const zipPath = path.join(appConfig.uploadsTempDir, `${tempToken}-${safeFileName}`);
  const extractDir = path.join(appConfig.uploadsTempDir, `${tempToken}-extract`);
  let publishedPath: string | null = null;

  try {
    const product = await prisma.product.findUnique({
      where: { key: input.productKey },
      include: { versions: true },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.versions.some((item) => item.version === input.version)) {
      throw new Error('Version already exists under this product');
    }

    if (input.fileSize > appConfig.uploadMaxBytes) {
      throw new Error(`Zip file exceeds ${process.env.UPLOAD_MAX_MB ?? '200'}MB limit`);
    }

    await fs.writeFile(zipPath, input.buffer);
    await extractZipToTemp(zipPath, extractDir);

    const indexRoot = await findIndexRoot(extractDir);
    if (!indexRoot) {
      throw new Error('Zip package must contain index.html');
    }

    const indexHtml = await fs.readFile(path.join(indexRoot, 'index.html'), 'utf8');
    const forbiddenReferences = detectForbiddenAbsoluteReferences(indexHtml);
    if (forbiddenReferences.length > 0) {
      throw new Error(`Detected root absolute asset references: ${forbiddenReferences.join(', ')}`);
    }

    publishedPath = await publishExtractedDir(input.productKey, input.version, indexRoot);
    const entryUrl = buildEntryUrl(input.productKey, input.version);
    const hasDefault = product.versions.some((item) => item.isDefault && item.status === 'published');

    await prisma.$transaction(async (transaction) => {
      if (!hasDefault) {
        await transaction.productVersion.updateMany({
          where: { productId: product.id },
          data: { isDefault: false },
        });
      }

      await transaction.productVersion.create({
        data: {
          productId: product.id,
          version: input.version,
          title: input.title || null,
          remark: input.remark || null,
          storagePath: publishedPath!,
          entryUrl,
          status: 'published',
          isDefault: !hasDefault,
        },
      });

      await transaction.uploadRecord.create({
        data: {
          productKey: input.productKey,
          version: input.version,
          fileName: safeFileName,
          fileSize: input.fileSize,
          status: 'success',
          errorMessage: null,
        },
      });
    });

    return {
      previewUrl: `${appConfig.appUrl}/preview?product=${input.productKey}&version=${input.version}`,
      entryUrl,
    };
  } catch (error) {
    if (publishedPath) {
      await fse.remove(publishedPath);
    }

    await prisma.uploadRecord.create({
      data: {
        productKey: input.productKey,
        version: input.version,
        fileName: input.fileName,
        fileSize: input.fileSize,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown upload error',
      },
    });

    throw error;
  } finally {
    await fse.remove(zipPath);
    await fse.remove(extractDir);
  }
}

