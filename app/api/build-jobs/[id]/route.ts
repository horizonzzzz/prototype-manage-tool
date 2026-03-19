import { fail, ok } from '@/lib/api';
import { getBuildJob } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    return ok(await getBuildJob(Number(id)));
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取任务详情失败', 400);
  }
}
