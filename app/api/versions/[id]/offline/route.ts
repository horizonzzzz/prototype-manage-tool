import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { setVersionOffline } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { id } = await context.params;
    await setVersionOffline(user.id, Number(id));
    return ok(null, '版本已下线');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '下线版本失败', 400);
  }
}

