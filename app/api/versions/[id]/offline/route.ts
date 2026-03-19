import { fail, ok } from '@/lib/api';
import { setVersionOffline } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await setVersionOffline(Number(id));
    return ok(null, '版本已下线');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '下线版本失败', 400);
  }
}

