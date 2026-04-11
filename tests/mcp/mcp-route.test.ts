import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  appConfigMock,
  getSourceTreeMock,
  listPublishedSnapshotProductsMock,
  listPublishedSnapshotVersionsMock,
  readSourceFileMock,
  resolvePublishedSnapshotVersionMock,
  searchSourceFilesMock,
} = vi.hoisted(() => ({
  appConfigMock: {
    mcpAuthToken: 'test-mcp-token',
  },
  getSourceTreeMock: vi.fn(),
  listPublishedSnapshotProductsMock: vi.fn(),
  listPublishedSnapshotVersionsMock: vi.fn(),
  readSourceFileMock: vi.fn(),
  resolvePublishedSnapshotVersionMock: vi.fn(),
  searchSourceFilesMock: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  appConfig: appConfigMock,
}));

vi.mock('@/lib/server/source-snapshot-service', () => ({
  getSourceTree: getSourceTreeMock,
  listPublishedSnapshotProducts: listPublishedSnapshotProductsMock,
  listPublishedSnapshotVersions: listPublishedSnapshotVersionsMock,
  readSourceFile: readSourceFileMock,
  resolvePublishedSnapshotVersion: resolvePublishedSnapshotVersionMock,
  searchSourceFiles: searchSourceFilesMock,
}));

import { DELETE, GET, POST } from '@/app/api/mcp/route';

describe('POST /api/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appConfigMock.mcpAuthToken = 'test-mcp-token';
  });

  test('returns 401 for unauthorized requests', async () => {
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
  });

  test('initializes successfully when bearer token is valid', async () => {
    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-mcp-token',
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
  });

  test('tools/call list_products includes crm when source snapshot service returns crm', async () => {
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
          Authorization: 'Bearer test-mcp-token',
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
  });
});

describe('non-POST /api/mcp methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appConfigMock.mcpAuthToken = 'test-mcp-token';
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
