import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getVersionSourceArchiveMock, readFileMock } = vi.hoisted(() => ({
  getVersionSourceArchiveMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('@/lib/server/upload-service', () => ({
  getVersionSourceArchive: getVersionSourceArchiveMock,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
  },
  readFile: readFileMock,
}));

import { GET } from '@/app/api/versions/[id]/download/route';

describe('GET /api/versions/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('streams the original archive with download headers', async () => {
    getVersionSourceArchiveMock.mockResolvedValue({
      fileName: 'crm-v1.0.0.zip',
      filePath: 'C:/archives/crm-v1.0.0.zip',
    });
    readFileMock.mockResolvedValue(Buffer.from('zip-bytes'));

    const response = await GET(new Request('http://localhost/api/versions/7/download'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('crm-v1.0.0.zip');
    expect(readFileMock).toHaveBeenCalledWith('C:/archives/crm-v1.0.0.zip');
    await expect(response.arrayBuffer()).resolves.toEqual(Uint8Array.from(Buffer.from('zip-bytes')).buffer);
  });

  test('supports unicode archive names without failing header encoding', async () => {
    getVersionSourceArchiveMock.mockResolvedValue({
      fileName: '产品预览-v1.0.0.zip',
      filePath: 'C:/archives/product-v1.0.0.zip',
    });
    readFileMock.mockResolvedValue(Buffer.from('zip-bytes'));

    const response = await GET(new Request('http://localhost/api/versions/8/download'), {
      params: Promise.resolve({ id: '8' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('filename="____-v1.0.0.zip"');
    expect(response.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''%E4%BA%A7%E5%93%81%E9%A2%84%E8%A7%88-v1.0.0.zip",
    );
  });

  test('returns a 404 payload when the original archive is unavailable', async () => {
    getVersionSourceArchiveMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/versions/7/download'), {
      params: Promise.resolve({ id: '7' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Original zip unavailable',
    });
  });
});
