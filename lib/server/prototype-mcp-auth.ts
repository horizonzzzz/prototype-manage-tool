import { fail } from '@/lib/api';
import { appConfig } from '@/lib/config';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function requirePrototypeMcpAuth(request: Request): Response | null {
  const configuredToken = appConfig.mcpAuthToken.trim();
  if (!configuredToken) {
    return fail('MCP endpoint is disabled', 503);
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken || bearerToken !== configuredToken) {
    return fail('Unauthorized', 401);
  }

  return null;
}
