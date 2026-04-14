import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  requirePrototypeMcpAuthMock,
  getSourceTreeMock,
  queryCodebaseSummaryMock,
  listPublishedSnapshotProductsMock,
  listPublishedSnapshotVersionsMock,
  readSourceFileMock,
  resolvePublishedSnapshotVersionMock,
  searchSourceFilesMock,
} = vi.hoisted(() => ({
  requirePrototypeMcpAuthMock: vi.fn(),
  getSourceTreeMock: vi.fn(),
  queryCodebaseSummaryMock: vi.fn(),
  listPublishedSnapshotProductsMock: vi.fn(),
  listPublishedSnapshotVersionsMock: vi.fn(),
  readSourceFileMock: vi.fn(),
  resolvePublishedSnapshotVersionMock: vi.fn(),
  searchSourceFilesMock: vi.fn(),
}));

vi.mock('@/lib/server/prototype-mcp-auth', () => ({
  requirePrototypeMcpAuth: requirePrototypeMcpAuthMock,
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  getSourceTree: getSourceTreeMock,
  listPublishedSnapshotProducts: listPublishedSnapshotProductsMock,
  listPublishedSnapshotVersions: listPublishedSnapshotVersionsMock,
  readSourceFile: readSourceFileMock,
  resolvePublishedSnapshotVersion: resolvePublishedSnapshotVersionMock,
  searchSourceFiles: searchSourceFilesMock,
}));

vi.mock('@/lib/server/source-index-service', () => ({
  queryCodebaseSummary: queryCodebaseSummaryMock,
}));

import { DELETE, GET, POST } from '@/app/api/mcp/route';

describe('POST /api/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePrototypeMcpAuthMock.mockResolvedValue({
      userId: 'user-1',
      apiKeyId: 101,
      allowedProductIds: [11],
    });
  });

  test('returns 401 for unauthorized requests', async () => {
    requirePrototypeMcpAuthMock.mockResolvedValueOnce(
      Response.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 },
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'init-unauthorized',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'mcp-route-test',
              version: '1.0.0',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: expect.stringMatching(/unauthorized/i),
    });
    expect(requirePrototypeMcpAuthMock).toHaveBeenCalledTimes(1);
  });

  test('initializes successfully when bearer token resolves to a valid api key scope', async () => {
    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'init-1',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
              name: 'mcp-route-test',
              version: '1.0.0',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 'init-1',
      result: expect.any(Object),
    });
    expect(requirePrototypeMcpAuthMock).toHaveBeenCalledTimes(1);
  });

  test('tools/call list_products passes mcp access scope into source snapshot service', async () => {
    listPublishedSnapshotProductsMock.mockResolvedValue([
      {
        productKey: 'crm',
        name: 'CRM',
        description: null,
        publishedVersionCount: 1,
        defaultVersion: 'v1.0.0',
      },
    ]);

    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-1',
          method: 'tools/call',
          params: {
            name: 'list_products',
            arguments: {},
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('crm'));
    expect(listPublishedSnapshotProductsMock).toHaveBeenCalledTimes(1);
    expect(listPublishedSnapshotProductsMock).toHaveBeenCalledWith({
      userId: 'user-1',
      apiKeyId: 101,
      allowedProductIds: [11],
    });
  });

  test('tools/call get_codebase_summary resolves selector and forwards mcp scope', async () => {
    queryCodebaseSummaryMock.mockResolvedValue({
      status: 'ready',
      warnings: [],
      payload: {
        framework: 'react',
      },
    });

    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-2',
          method: 'tools/call',
          params: {
            name: 'get_codebase_summary',
            arguments: {
              productKey: 'crm',
              selector: 'latest',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('react'));
    expect(queryCodebaseSummaryMock).toHaveBeenCalledTimes(1);
    expect(queryCodebaseSummaryMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      {
        productKey: 'crm',
        selector: 'latest',
        exactVersion: undefined,
      },
    );
  });
});

describe('non-POST /api/mcp methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePrototypeMcpAuthMock.mockResolvedValue({
      userId: 'user-1',
      apiKeyId: 101,
      allowedProductIds: [11],
    });
  });

  test('GET returns 405 method not allowed', async () => {
    const response = await GET(
      new Request('http://localhost/api/mcp', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: expect.stringMatching(/method not allowed/i),
    });
  });

  test('DELETE returns 405 method not allowed', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/mcp', {
        method: 'DELETE',
      }),
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: expect.stringMatching(/method not allowed/i),
    });
  });
});
