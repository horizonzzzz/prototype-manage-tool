import { ok } from '@/lib/api';
import { fail } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { getManifest } from '@/lib/server/manifest-service';

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user?.id) {
    return fail('Unauthorized', 401);
  }

  const { searchParams } = new URL(request.url);
  const data = await getManifest(user.id, searchParams.get('product') ?? undefined, searchParams.get('version') ?? undefined);
  return ok(data);
}

