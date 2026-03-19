import { fail, ok } from '@/lib/api';
import { deleteVersion } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteVersion(Number(id));
    return ok(null, '版本已删除');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '删除版本失败', 400);
  }
}

