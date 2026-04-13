import { beforeEach, describe, expect, test, vi } from 'vitest';

const { authMock, productVersionFindFirstMock, statMock, readFileMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  productVersionFindFirstMock: vi.fn(),
  statMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVersion: {
      findFirst: productVersionFindFirstMock,
    },
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    stat: statMock,
    readFile: readFileMock,
  },
  stat: statMock,
  readFile: readFileMock,
}));

import { GET } from '@/app/prototypes/[...slug]/route';

describe('/prototypes/[...slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: {
        id: 'viewer-user',
      },
    });
    productVersionFindFirstMock.mockResolvedValue({
      storagePath: 'C:/data/prototypes/owner-user/crm/v1.0.0',
    });
    statMock.mockResolvedValue({
      isFile: () => true,
    });
    readFileMock.mockResolvedValue(Buffer.from('<html>owner preview</html>'));
  });

  test('resolves published prototype assets by owner id from the url instead of the viewer id', async () => {
    const response = await GET(new Request('http://localhost/prototypes/owner-user/crm/v1.0.0/index.html'), {
      params: Promise.resolve({ slug: ['owner-user', 'crm', 'v1.0.0', 'index.html'] }),
    });

    expect(response.status).toBe(200);
    expect(productVersionFindFirstMock).toHaveBeenCalledWith({
      where: {
        version: 'v1.0.0',
        status: 'published',
        product: {
          key: 'crm',
          ownerId: 'owner-user',
        },
      },
      select: {
        storagePath: true,
      },
    });
  });

  test('rejects legacy prototype urls that omit the owner id path segment', async () => {
    const response = await GET(new Request('http://localhost/prototypes/crm/v1.0.0/index.html'), {
      params: Promise.resolve({ slug: ['crm', 'v1.0.0', 'index.html'] }),
    });

    expect(response.status).toBe(404);
    expect(productVersionFindFirstMock).not.toHaveBeenCalled();
  });
});
