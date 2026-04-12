import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { getBuildJob } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { id } = await context.params;
    return ok(await getBuildJob(user.id, Number(id)));
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取任务详情失败', 400);
  }
}
