import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import zod from 'zod/v4';

import type { McpAccessScope } from '@/lib/server/mcp-api-key-service';
import {
  getSourceIndexStatus,
  queryCodebaseSummary,
  queryComponentContext,
  queryTypeDefinition,
  searchSourceWithContext,
} from '@/lib/server/source-index-service';
import {
  getSourceTree,
  listPublishedSnapshotProducts,
  listPublishedSnapshotVersions,
  readSourceFile,
  resolvePublishedSnapshotVersion,
  searchSourceFiles,
} from '@/lib/server/source-snapshot-service';

function optionalIntegerInput(minimum: number) {
  return zod.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
      }
    }

    return value;
  }, zod.number().int().min(minimum).optional());
}

function formatToolResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload),
      },
    ],
  };
}

export function createPrototypeMcpServer(scope: McpAccessScope) {
  const server = new McpServer({
    name: 'prototype-manage-tool',
    version: '1.0.0',
  });

  server.registerTool(
    'list_products',
    { description: 'List products with published source snapshots.' },
    async () => formatToolResult(await listPublishedSnapshotProducts(scope)),
  );

  server.registerTool(
    'list_versions',
    {
      description: 'List published source-snapshot versions for a product.',
      inputSchema: { productKey: zod.string().min(1) },
    },
    async ({ productKey }) => formatToolResult(await listPublishedSnapshotVersions(scope, productKey)),
  );

  server.registerTool(
    'resolve_version',
    {
      description: 'Resolve a published source-snapshot version selector for a product.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
      },
    },
    async ({ productKey, selector, exactVersion }) => {
      const resolvedSelector = exactVersion ? { exact: exactVersion } : (selector ?? 'default');
      return formatToolResult(await resolvePublishedSnapshotVersion(scope, productKey, resolvedSelector));
    },
  );

  server.registerTool(
    'get_source_tree',
    {
      description: 'Read a source snapshot tree for a product version.',
      inputSchema: {
        productKey: zod.string().min(1),
        version: zod.string().min(1),
        path: zod.string().optional(),
        depth: optionalIntegerInput(0),
      },
    },
    async ({ productKey, version, path, depth }) =>
      formatToolResult(await getSourceTree(scope, productKey, version, path, depth)),
  );

  server.registerTool(
    'read_source_file',
    {
      description: 'Read a file from a source snapshot.',
      inputSchema: {
        productKey: zod.string().min(1),
        version: zod.string().min(1),
        path: zod.string().min(1),
        startLine: optionalIntegerInput(1),
        endLine: optionalIntegerInput(1),
      },
    },
    async ({ productKey, version, path, startLine, endLine }) =>
      formatToolResult(await readSourceFile(scope, productKey, version, path, { startLine, endLine })),
  );

  server.registerTool(
    'search_source_files',
    {
      description: 'Search text in source snapshot files.',
      inputSchema: { productKey: zod.string().min(1), version: zod.string().min(1), query: zod.string() },
    },
    async ({ productKey, version, query }) => formatToolResult(await searchSourceFiles(scope, productKey, version, query)),
  );

  // Indexed source tools
  server.registerTool(
    'get_codebase_summary',
    {
      description: 'Get a high-level codebase summary for a published source snapshot.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
      },
    },
    async (input) => formatToolResult(await queryCodebaseSummary(scope, input)),
  );

  server.registerTool(
    'search_with_context',
    {
      description: 'Search text in indexed source files and return contextual matches.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
        query: zod.string(),
        contextLines: optionalIntegerInput(0),
      },
    },
    async (input) => formatToolResult(await searchSourceWithContext(scope, input)),
  );

  server.registerTool(
    'get_component_context',
    {
      description: 'Get indexed context for a component or page-like module.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
        componentName: zod.string().min(1),
      },
    },
    async (input) => formatToolResult(await queryComponentContext(scope, input)),
  );

  server.registerTool(
    'get_type_definitions',
    {
      description: 'Get indexed type definition locations and usage context.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
        typeName: zod.string().min(1),
      },
    },
    async (input) => formatToolResult(await queryTypeDefinition(scope, input)),
  );

  server.registerTool(
    'get_source_index_status',
    {
      description: 'Get source index build status for a published source snapshot.',
      inputSchema: {
        productKey: zod.string().min(1),
        selector: zod.enum(['default', 'latest']).optional(),
        exactVersion: zod.string().min(1).optional(),
      },
    },
    async (input) => formatToolResult(await getSourceIndexStatus(scope, input)),
  );

  return server;
}
