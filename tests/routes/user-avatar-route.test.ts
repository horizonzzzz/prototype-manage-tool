import { beforeEach, describe, expect, test, vi } from 'vitest';

const { statMock, readFileMock } = vi.hoisted(() => ({
  statMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    stat: statMock,
    readFile: readFileMock,
  },
  stat: statMock,
  readFile: readFileMock,
}));

import { GET } from '@/app/user-avatars/[...slug]/route';

describe('/user-avatars/[...slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statMock.mockResolvedValue({
      isFile: () => true,
    });
    readFileMock.mockResolvedValue(Buffer.from('avatar-bytes'));
  });

  test('serves stored avatar image files from the managed avatar directory', async () => {
    const response = await GET(new Request('http://localhost/user-avatars/user-1/avatar-123.png'), {
      params: Promise.resolve({ slug: ['user-1', 'avatar-123.png'] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  test('rejects avatar urls that try to escape the managed directory', async () => {
    const response = await GET(new Request('http://localhost/user-avatars/user-1/../../secrets.txt'), {
      params: Promise.resolve({ slug: ['user-1', '..', '..', 'secrets.txt'] }),
    });

    expect(response.status).toBe(404);
    expect(statMock).not.toHaveBeenCalled();
  });
});
