import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { deleteUserMcpApiKey } from '@/lib/server/mcp-api-key-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: Context) {
  void request;

  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { id } = await context.params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return fail('Invalid MCP key id', 400);
    }

    await deleteUserMcpApiKey(user.id, parsedId);
    return ok(null, 'MCP key 已删除');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'MCP key 删除失败', 404);
  }
}
