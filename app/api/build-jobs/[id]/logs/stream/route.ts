import { fail } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { getBuildJobLogStreamResponse } from '@/lib/server/build-job-service';

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

    return await getBuildJobLogStreamResponse(user.id, Number(id), step, request.signal);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取实时任务日志失败', 400);
  }
}
