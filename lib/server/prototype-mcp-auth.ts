import { fail } from '@/lib/api';
import { resolveMcpAccessScope } from '@/lib/server/mcp-api-key-service';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function requirePrototypeMcpAuth(request: Request) {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return fail('Unauthorized', 401);
  }

  const scope = await resolveMcpAccessScope(bearerToken);
  if (!scope) {
    return fail('Unauthorized', 401);
  }

  return scope;
}
