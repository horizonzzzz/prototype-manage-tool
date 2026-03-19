import { fail, ok } from '@/lib/api';
import { listBuildJobs } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ key: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { key } = await context.params;
    return ok(await listBuildJobs(key));
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取任务列表失败', 400);
  }
}
