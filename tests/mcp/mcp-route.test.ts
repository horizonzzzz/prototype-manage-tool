import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  requirePrototypeMcpAuthMock,
  getSourceTreeMock,
  getSourceIndexStatusMock,
  queryCodebaseSummaryMock,
  queryComponentContextMock,
  queryTypeDefinitionMock,
  searchSourceWithContextMock,
  listPublishedSnapshotProductsMock,
  listPublishedSnapshotVersionsMock,
  readSourceFileMock,
  resolvePublishedSnapshotVersionMock,
  searchSourceFilesMock,
} = vi.hoisted(() => ({
  requirePrototypeMcpAuthMock: vi.fn(),
  getSourceTreeMock: vi.fn(),
  getSourceIndexStatusMock: vi.fn(),
  queryCodebaseSummaryMock: vi.fn(),
  queryComponentContextMock: vi.fn(),
  queryTypeDefinitionMock: vi.fn(),
  searchSourceWithContextMock: vi.fn(),
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
  getSourceIndexStatus: getSourceIndexStatusMock,
  queryCodebaseSummary: queryCodebaseSummaryMock,
  queryComponentContext: queryComponentContextMock,
  queryTypeDefinition: queryTypeDefinitionMock,
  searchSourceWithContext: searchSourceWithContextMock,
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

  test('tools/call get_component_context forwards semantic tool arguments and scope', async () => {
    queryComponentContextMock.mockResolvedValue({
      status: 'ready',
      warnings: [],
      payload: {
        component: 'Button',
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
          id: 'tool-component-context',
          method: 'tools/call',
          params: {
            name: 'get_component_context',
            arguments: {
              productKey: 'crm',
              exactVersion: 'v1.0.0',
              componentName: 'Button',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('Button'));
    expect(queryComponentContextMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      {
        productKey: 'crm',
        selector: undefined,
        exactVersion: 'v1.0.0',
        componentName: 'Button',
      },
    );
  });

  test('tools/call get_type_definitions forwards semantic tool arguments and scope', async () => {
    queryTypeDefinitionMock.mockResolvedValue({
      status: 'ready',
      warnings: [],
      payload: {
        typeName: 'ButtonProps',
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
          id: 'tool-type-definitions',
          method: 'tools/call',
          params: {
            name: 'get_type_definitions',
            arguments: {
              productKey: 'crm',
              selector: 'default',
              typeName: 'ButtonProps',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('ButtonProps'));
    expect(queryTypeDefinitionMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      {
        productKey: 'crm',
        selector: 'default',
        exactVersion: undefined,
        typeName: 'ButtonProps',
      },
    );
  });

  test('tools/call get_source_index_status forwards semantic status requests and scope', async () => {
    getSourceIndexStatusMock.mockResolvedValue({
      status: 'ready',
      warnings: [],
      payload: {
        generatedAt: '2024-01-01T00:00:00.000Z',
        errorMessage: null,
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
          id: 'tool-index-status',
          method: 'tools/call',
          params: {
            name: 'get_source_index_status',
            arguments: {
              productKey: 'crm',
              selector: 'latest',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) =>
      JSON.stringify(payload).includes('2024-01-01T00:00:00.000Z'),
    );
    expect(getSourceIndexStatusMock).toHaveBeenCalledWith(
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

  test('tools/call resolve_version rejects null exactVersion during validation', async () => {
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
          id: 'tool-resolve-null',
          method: 'tools/call',
          params: {
            name: 'resolve_version',
            arguments: {
              productKey: 'crm',
              exactVersion: null,
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => {
      const serialized = JSON.stringify(payload);
      return serialized.includes('-32602') && serialized.includes('exactVersion');
    });
    expect(resolvePublishedSnapshotVersionMock).not.toHaveBeenCalled();
  });

  test('tools/call get_source_tree preserves undefined depth and coerces numeric strings', async () => {
    getSourceTreeMock.mockResolvedValue({
      path: '.',
      type: 'directory',
      depth: 1,
      tree: { name: '.', path: '.', type: 'directory', entries: [] },
    });

    const noDepthResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-tree-default-depth',
          method: 'tools/call',
          params: {
            name: 'get_source_tree',
            arguments: {
              productKey: 'crm',
              version: 'v1.0.0',
            },
          },
        }),
      }),
    );

    expect(noDepthResponse.status).toBe(200);
    await expect(noDepthResponse.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('directory'));
    expect(getSourceTreeMock).toHaveBeenNthCalledWith(
      1,
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      'crm',
      'v1.0.0',
      undefined,
      undefined,
    );

    const stringDepthResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-tree-string-depth',
          method: 'tools/call',
          params: {
            name: 'get_source_tree',
            arguments: {
              productKey: 'crm',
              version: 'v1.0.0',
              depth: '2',
            },
          },
        }),
      }),
    );

    expect(stringDepthResponse.status).toBe(200);
    await expect(stringDepthResponse.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('directory'));
    expect(getSourceTreeMock).toHaveBeenNthCalledWith(
      2,
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      'crm',
      'v1.0.0',
      undefined,
      2,
    );
  });

  test('tools/call get_source_tree rejects null depth during validation', async () => {
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
          id: 'tool-tree-null-depth',
          method: 'tools/call',
          params: {
            name: 'get_source_tree',
            arguments: {
              productKey: 'crm',
              version: 'v1.0.0',
              depth: null,
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => {
      const serialized = JSON.stringify(payload);
      return serialized.includes('-32602') && serialized.includes('depth');
    });
    expect(getSourceTreeMock).not.toHaveBeenCalled();
  });

  test('tools/call read_source_file coerces numeric strings and rejects null startLine', async () => {
    readSourceFileMock.mockResolvedValue({
      path: 'src/app.ts',
      content: 'line 2\nline 3',
      startLine: 2,
      endLine: 3,
      totalLines: 10,
      truncated: true,
    });

    const validResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-read-string-lines',
          method: 'tools/call',
          params: {
            name: 'read_source_file',
            arguments: {
              productKey: 'crm',
              version: 'v1.0.0',
              path: 'src/app.ts',
              startLine: '2',
              endLine: '3',
            },
          },
        }),
      }),
    );

    expect(validResponse.status).toBe(200);
    await expect(validResponse.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('src/app.ts'));
    expect(readSourceFileMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      'crm',
      'v1.0.0',
      'src/app.ts',
      { startLine: 2, endLine: 3 },
    );

    const invalidResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-read-null-start',
          method: 'tools/call',
          params: {
            name: 'read_source_file',
            arguments: {
              productKey: 'crm',
              version: 'v1.0.0',
              path: 'src/app.ts',
              startLine: null,
            },
          },
        }),
      }),
    );

    expect(invalidResponse.status).toBe(200);
    await expect(invalidResponse.json()).resolves.toSatisfy((payload: unknown) => {
      const serialized = JSON.stringify(payload);
      return serialized.includes('-32602') && serialized.includes('startLine');
    });
  });

  test('tools/call search_with_context coerces numeric strings and rejects object exactVersion', async () => {
    searchSourceWithContextMock.mockResolvedValue({
      status: 'ready',
      warnings: [],
      payload: {
        query: 'Button',
        results: [],
        truncated: false,
      },
    });

    const validResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-search-context-valid',
          method: 'tools/call',
          params: {
            name: 'search_with_context',
            arguments: {
              productKey: 'crm',
              query: 'Button',
              contextLines: '3',
            },
          },
        }),
      }),
    );

    expect(validResponse.status).toBe(200);
    await expect(validResponse.json()).resolves.toSatisfy((payload: unknown) => JSON.stringify(payload).includes('Button'));
    expect(searchSourceWithContextMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        apiKeyId: 101,
        allowedProductIds: [11],
      },
      {
        productKey: 'crm',
        selector: undefined,
        exactVersion: undefined,
        query: 'Button',
        contextLines: 3,
      },
    );

    const invalidResponse = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer user-scope-token',
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'tool-search-context-invalid',
          method: 'tools/call',
          params: {
            name: 'search_with_context',
            arguments: {
              productKey: 'crm',
              query: 'Button',
              exactVersion: { value: 'v1.0.0' },
            },
          },
        }),
      }),
    );

    expect(invalidResponse.status).toBe(200);
    await expect(invalidResponse.json()).resolves.toSatisfy((payload: unknown) => {
      const serialized = JSON.stringify(payload);
      return serialized.includes('-32602') && serialized.includes('exactVersion');
    });
  });

  test('tools/call get_mock_data returns unknown tool after removal', async () => {
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
          id: 'tool-removed',
          method: 'tools/call',
          params: {
            name: 'get_mock_data',
            arguments: {
              productKey: 'crm',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toSatisfy((payload: unknown) => {
      const serialized = JSON.stringify(payload).toLowerCase();
      return serialized.includes('get_mock_data') && (serialized.includes('unknown') || serialized.includes('not found'));
    });
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
