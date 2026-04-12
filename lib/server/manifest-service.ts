import { unstable_noStore as noStore } from 'next/cache';

import { pickVersionForPreview } from '@/lib/domain/preview';
import { prisma } from '@/lib/prisma';
import { serializeManifestProduct } from '@/lib/server/serializers';

export async function getManifest(userId: string, selectedProduct?: string, selectedVersion?: string) {
  noStore();

  const products = await prisma.product.findMany({
    where: { ownerId: userId },
    include: {
      versions: {
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const manifestProducts = products.map(serializeManifestProduct).filter((item) => item.versions.length > 0);
  const resolvedProduct = manifestProducts.find((item) => item.key === selectedProduct) ?? manifestProducts[0];
  const resolvedVersion = resolvedProduct
    ? pickVersionForPreview(
        resolvedProduct.versions.map((item) => ({
          version: item.version,
          isDefault: item.isDefault,
          createdAt: new Date(item.createdAt),
        })),
        selectedVersion,
      )
    : undefined;

  return {
    products: manifestProducts,
    resolved: {
      productKey: resolvedProduct?.key,
      version: resolvedVersion?.version,
    },
  };
}
