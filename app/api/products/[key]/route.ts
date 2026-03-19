import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeProductDetail } from '@/lib/server/serializers';

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

