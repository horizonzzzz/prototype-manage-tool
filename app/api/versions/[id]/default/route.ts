import { fail, ok } from '@/lib/api';
import { setDefaultVersion } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await setDefaultVersion(Number(id));
    return ok(null, '默认版本已更新');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '更新默认版本失败', 400);
  }
}

