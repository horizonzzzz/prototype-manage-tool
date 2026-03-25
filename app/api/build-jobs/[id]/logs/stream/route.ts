import { fail } from '@/lib/api';
import { getBuildJobLogStreamResponse } from '@/lib/server/build-job-service';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const step = searchParams.get('step');

    if (!step) {
      return fail('Missing required step query parameter', 400);
    }

    return await getBuildJobLogStreamResponse(Number(id), step, request.signal);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '获取实时任务日志失败', 400);
  }
}
