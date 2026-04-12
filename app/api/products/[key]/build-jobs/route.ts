import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { listBuildJobs } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ key: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { key } = await context.params;
    return ok(await listBuildJobs(user.id, key));
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取任务列表失败', 400);
  }
}
