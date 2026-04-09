import { z } from 'zod';

import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeProductListItem } from '@/lib/server/serializers';

const createProductSchema = z.object({
  key: z.string().regex(/^[a-z0-9._-]+$/i, '产品 Key 只能包含字母、数字、点、下划线和中划线'),
  name: z.string().min(1, '产品名称不能为空'),
  description: z.string().optional(),
});

export async function GET() {
  const products = await prisma.product.findMany({
    include: { versions: true },
    orderBy: { createdAt: 'desc' },
  });

  return ok(products.map(serializeProductListItem));
}

export async function POST(request: Request) {
  try {
    const parsed = createProductSchema.parse(await request.json());
    const product = await prisma.product.create({
      data: {
        key: parsed.key,
        name: parsed.name,
        description: parsed.description || null,
      },
      include: { versions: true },
    });

    return ok(serializeProductListItem(product), '产品创建成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.issues[0]?.message ?? '参数错误', 400);
    }

    return fail(error instanceof Error ? error.message : '创建产品失败', 400);
  }
}
