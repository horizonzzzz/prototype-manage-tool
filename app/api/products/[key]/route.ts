import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeProductDetail } from '@/lib/server/serializers';
import { deleteProduct } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ key: string }>;
};

export async function GET(_: Request, context: Context) {
  const { key } = await context.params;
  const product = await prisma.product.findUnique({
    where: { key },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!product) {
    return fail('Product not found', 404);
  }

  return ok(serializeProductDetail(product));
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { key } = await context.params;
    await deleteProduct(key);
    return ok(null, '产品已删除');
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除产品失败';
    return fail(message, message === 'Product not found' ? 404 : 400);
  }
}
