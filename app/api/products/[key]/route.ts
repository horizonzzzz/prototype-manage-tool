import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { prisma } from '@/lib/prisma';
import { serializeProductDetail } from '@/lib/server/serializers';
import { deleteProduct, getVersionDownloadabilityMap } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ key: string }>;
};

export async function GET(_: Request, context: Context) {
  const user = await getApiUser();
  if (!user?.id) {
    return fail('Unauthorized', 401);
  }

  const { key } = await context.params;
  const product = await prisma.product.findFirst({
    where: { key, ownerId: user.id },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!product) {
    return fail('Product not found', 404);
  }

  const downloadabilityMap = await getVersionDownloadabilityMap(
    user.id,
    key,
    product.versions.map((version) => version.version),
  );

  return ok(serializeProductDetail(product, downloadabilityMap));
}

export async function DELETE(_: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { key } = await context.params;
    await deleteProduct(user.id, key);
    return ok(null, '产品已删除');
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除产品失败';
    return fail(message, message === 'Product not found' ? 404 : 400);
  }
}
