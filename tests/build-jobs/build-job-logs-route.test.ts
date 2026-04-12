import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getBuildJobLogMock } = vi.hoisted(() => ({
  getBuildJobLogMock: vi.fn(),
}));

vi.mock('@/lib/server/api-auth', () => ({
  getApiUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/server/build-job-service', () => ({
  getBuildJobLog: getBuildJobLogMock,
}));

import { GET } from '@/app/api/build-jobs/[id]/logs/route';

describe('GET /api/build-jobs/[id]/logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns the requested log payload', async () => {
    getBuildJobLogMock.mockResolvedValue({
      step: 'extract',
      content: '阶段: 解压源码包',
      exists: true,
      updatedAt: '2026-03-25T08:00:00.000Z',
    });

    const response = await GET(new Request('http://localhost/api/build-jobs/7/logs?step=extract'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        step: 'extract',
        exists: true,
      },
    });
    expect(getBuildJobLogMock).toHaveBeenCalledWith('user-1', 7, 'extract');
  });

  test('returns a 400 payload for invalid step requests', async () => {
    getBuildJobLogMock.mockRejectedValue(new Error('Unsupported log step'));

    const response = await GET(new Request('http://localhost/api/build-jobs/7/logs?step=unknown'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Unsupported log step',
    });
  });
});
