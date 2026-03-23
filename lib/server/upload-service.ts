import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { ensureChildPath, ensureVersionPathInsideRoot } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import { createBuildJob } from '@/lib/server/build-job-service';

type UploadInput = {
  productKey: string;
  version: string;
  title?: string;
  remark?: string;
  fileName: string;
  fileSize: number;
  buffer: Buffer;
};

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
}

export async function processPrototypeUpload(input: UploadInput) {
  return await createBuildJob(input);
}
