import { beforeEach, describe, expect, test, vi } from 'vitest';

const { resolveMcpAccessScopeMock } = vi.hoisted(() => ({
  resolveMcpAccessScopeMock: vi.fn(),
}));

vi.mock('@/lib/server/mcp-api-key-service', () => ({
  resolveMcpAccessScope: resolveMcpAccessScopeMock,
}));

import { requirePrototypeMcpAuth } from '@/lib/server/prototype-mcp-auth';

describe('prototype mcp auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns a user access scope for valid bearer tokens', async () => {
    resolveMcpAccessScopeMock.mockResolvedValue({
      userId: 'user-1',
      apiKeyId: 101,
      allowedProductIds: [11, 12],
    });

    const result = await requirePrototypeMcpAuth(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mcp_live_token_123456',
        },
      }),
    );

    expect(result).toEqual({
      userId: 'user-1',
      apiKeyId: 101,
      allowedProductIds: [11, 12],
    });
    expect(resolveMcpAccessScopeMock).toHaveBeenCalledWith('mcp_live_token_123456');
  });

  test('returns 401 when bearer token is missing', async () => {
    const result = await requirePrototypeMcpAuth(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
      }),
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Unauthorized',
    });
    expect(resolveMcpAccessScopeMock).not.toHaveBeenCalled();
  });

  test('returns 401 when service cannot resolve the token', async () => {
    resolveMcpAccessScopeMock.mockResolvedValue(null);

    const result = await requirePrototypeMcpAuth(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer expired_or_invalid_token',
        },
      }),
    );

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: 'Unauthorized',
    });
  });
});
