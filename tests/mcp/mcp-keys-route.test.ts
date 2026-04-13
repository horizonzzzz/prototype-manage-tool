import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  getApiUserMock,
  createUserMcpApiKeyMock,
  deleteUserMcpApiKeyMock,
  listUserMcpApiKeysMock,
} = vi.hoisted(() => ({
  getApiUserMock: vi.fn(),
  createUserMcpApiKeyMock: vi.fn(),
  deleteUserMcpApiKeyMock: vi.fn(),
  listUserMcpApiKeysMock: vi.fn(),
}));

vi.mock('@/lib/server/api-auth', () => ({
  getApiUser: getApiUserMock,
}));

vi.mock('@/lib/server/mcp-api-key-service', () => ({
  createUserMcpApiKey: createUserMcpApiKeyMock,
  deleteUserMcpApiKey: deleteUserMcpApiKeyMock,
  listUserMcpApiKeys: listUserMcpApiKeysMock,
}));

import { GET, POST } from '@/app/api/mcp/keys/route';
import { DELETE } from '@/app/api/mcp/keys/[id]/route';

describe('/api/mcp/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    });
  });

  test('lists only the current user mcp keys', async () => {
    listUserMcpApiKeysMock.mockResolvedValue([
      {
        id: 1,
        name: 'Production Access',
        token: 'mcp_live_token_123456',
        tokenPreview: 'mcp_live_tok...3456',
        expiresAt: null,
        createdAt: '2026-04-13T00:00:00.000Z',
        products: [{ id: 11, key: 'crm', name: 'CRM' }],
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ name: 'Production Access', token: 'mcp_live_token_123456' }],
    });
    expect(listUserMcpApiKeysMock).toHaveBeenCalledWith('user-1');
  });

  test('creates a user-scoped mcp key with required product authorizations', async () => {
    createUserMcpApiKeyMock.mockResolvedValue({
      id: 1,
      name: 'Production Access',
      token: 'mcp_live_token_123456',
      tokenPreview: 'mcp_live_tok...3456',
      expiresAt: '2026-05-13T00:00:00.000Z',
      createdAt: '2026-04-13T00:00:00.000Z',
      products: [{ id: 11, key: 'crm', name: 'CRM' }],
    });

    const response = await POST(
      new Request('http://localhost/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Access',
          productIds: [11],
          expiresAt: '2026-05-13T00:00:00.000Z',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createUserMcpApiKeyMock).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Production Access',
      productIds: [11],
      expiresAt: '2026-05-13T00:00:00.000Z',
    });
  });

  test('rejects empty product authorizations when creating a key', async () => {
    const response = await POST(
      new Request('http://localhost/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production Access',
          productIds: [],
          expiresAt: null,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(createUserMcpApiKeyMock).not.toHaveBeenCalled();
  });
});

describe('/api/mcp/keys/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    });
  });

  test('deletes only the current user mcp key', async () => {
    const response = await DELETE(new Request('http://localhost/api/mcp/keys/9', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '9' }),
    });

    expect(response.status).toBe(200);
    expect(deleteUserMcpApiKeyMock).toHaveBeenCalledWith('user-1', 9);
  });
});
