import { z } from 'zod';

import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { createUserMcpApiKey, listUserMcpApiKeys } from '@/lib/server/mcp-api-key-service';

const createMcpKeySchema = z.object({
  name: z.string().trim().min(1, '请输入 Key 名称'),
  productIds: z.array(z.number().int().positive()).min(1, '请至少授权一个产品'),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export async function GET() {
  const user = await getApiUser();
  if (!user?.id) {
    return fail('Unauthorized', 401);
  }

  return ok(await listUserMcpApiKeys(user.id));
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const parsed = createMcpKeySchema.parse(await request.json());
    const created = await createUserMcpApiKey({
      userId: user.id,
      name: parsed.name,
      productIds: parsed.productIds,
      expiresAt: parsed.expiresAt ?? null,
    });

    return ok(created, 'MCP key 创建成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.issues[0]?.message ?? '参数错误', 400);
    }

    return fail(error instanceof Error ? error.message : 'MCP key 创建失败', 400);
  }
}
