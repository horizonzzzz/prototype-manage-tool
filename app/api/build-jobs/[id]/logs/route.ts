import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { getBuildJobLog } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step');

    if (!step) {
      return fail('Missing required step query parameter', 400);
    }

    return ok(await getBuildJobLog(user.id, Number(id), step));
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取任务日志失败', 400);
  }
}
