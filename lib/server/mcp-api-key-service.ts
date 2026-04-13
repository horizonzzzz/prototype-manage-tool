import { prisma } from '@/lib/prisma';
import type { McpApiKeyItem } from '@/lib/types';
import {
  buildMcpTokenPreview,
  decryptMcpApiToken,
  encryptMcpApiToken,
  generateMcpApiToken,
  getMcpTokenPrefix,
  getMcpTokenSuffix,
  hashMcpApiToken,
} from '@/lib/server/mcp-token-crypto';

export type McpAccessScope = {
  userId: string;
  apiKeyId: number;
  allowedProductIds: number[];
};

type CreateUserMcpApiKeyInput = {
  userId: string;
  name: string;
  productIds: number[];
  expiresAt?: string | null;
};

function serializeMcpApiKeyItem(record: {
  id: number;
  name: string;
  tokenCiphertext: string;
  createdAt: Date;
  expiresAt: Date | null;
  productGrants: Array<{
    product: {
      id: number;
      key: string;
      name: string;
    };
  }>;
}): McpApiKeyItem {
  const token = decryptMcpApiToken(record.tokenCiphertext);

  return {
    id: record.id,
    name: record.name,
    token,
    tokenPreview: buildMcpTokenPreview(token),
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    products: record.productGrants.map((grant) => ({
      id: grant.product.id,
      key: grant.product.key,
      name: grant.product.name,
    })),
  };
}

export async function listUserMcpApiKeys(userId: string): Promise<McpApiKeyItem[]> {
  const records = await prisma.mcpApiKey.findMany({
    where: { userId },
    include: {
      productGrants: {
        include: {
          product: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
        orderBy: {
          productId: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return records.map(serializeMcpApiKeyItem);
}

export async function createUserMcpApiKey(input: CreateUserMcpApiKeyInput): Promise<McpApiKeyItem> {
  const productIds = [...new Set(input.productIds)];
  if (!productIds.length) {
    throw new Error('At least one product must be authorized');
  }

  const products = await prisma.product.findMany({
    where: {
      ownerId: input.userId,
      id: {
        in: productIds,
      },
    },
    select: {
      id: true,
      key: true,
      name: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new Error('One or more authorized products are invalid');
  }

  const token = generateMcpApiToken();
  const record = await prisma.mcpApiKey.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      tokenHash: hashMcpApiToken(token),
      tokenCiphertext: encryptMcpApiToken(token),
      tokenPrefix: getMcpTokenPrefix(token),
      tokenSuffix: getMcpTokenSuffix(token),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      productGrants: {
        create: productIds.map((productId) => ({
          productId,
        })),
      },
    },
    include: {
      productGrants: {
        include: {
          product: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
        orderBy: {
          productId: 'asc',
        },
      },
    },
  });

  return serializeMcpApiKeyItem(record);
}

export async function deleteUserMcpApiKey(userId: string, id: number) {
  const deleted = await prisma.mcpApiKey.deleteMany({
    where: {
      id,
      userId,
    },
  });

  if (!deleted.count) {
    throw new Error('MCP key not found');
  }
}

export async function resolveMcpAccessScope(token: string): Promise<McpAccessScope | null> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  const record = await prisma.mcpApiKey.findUnique({
    where: {
      tokenHash: hashMcpApiToken(normalizedToken),
    },
    include: {
      productGrants: {
        select: {
          productId: true,
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    userId: record.userId,
    apiKeyId: record.id,
    allowedProductIds: record.productGrants.map((grant) => grant.productId),
  };
}
