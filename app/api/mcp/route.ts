import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { fail } from '@/lib/api';
import { requirePrototypeMcpAuth } from '@/lib/server/prototype-mcp-auth';
import { createPrototypeMcpServer } from '@/lib/server/prototype-mcp-server';

async function handleMcpRequest(request: Request) {
  const authResult = await requirePrototypeMcpAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const server = createPrototypeMcpServer(authResult);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'MCP route error', 500);
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

export async function GET(request: Request) {
  void request;
  return fail('Method not allowed. Use POST for MCP requests.', 405);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  void request;
  return fail('Method not allowed. Use POST for MCP requests.', 405);
}
