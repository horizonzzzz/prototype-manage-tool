import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getBuildJobLogStreamResponseMock } = vi.hoisted(() => ({
  getBuildJobLogStreamResponseMock: vi.fn(),
}));

vi.mock('@/lib/server/build-job-service', () => ({
  getBuildJobLogStreamResponse: getBuildJobLogStreamResponseMock,
}));

import { GET } from '@/app/api/build-jobs/[id]/logs/stream/route';

describe('GET /api/build-jobs/[id]/logs/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns an SSE response for install/build stream requests', async () => {
    getBuildJobLogStreamResponseMock.mockResolvedValue(
      new Response('event: ready\ndata: {}\n\n', {
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    const response = await GET(new Request('http://localhost/api/build-jobs/7/logs/stream?step=install'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(getBuildJobLogStreamResponseMock).toHaveBeenCalledWith(7, 'install', expect.any(AbortSignal));
  });

  test('returns a 400 payload for non-streamable steps', async () => {
    getBuildJobLogStreamResponseMock.mockRejectedValue(new Error('Unsupported realtime log step'));

    const response = await GET(new Request('http://localhost/api/build-jobs/7/logs/stream?step=extract'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Unsupported realtime log step',
    });
  });
});
