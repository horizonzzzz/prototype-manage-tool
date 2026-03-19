import { ok } from '@/lib/api';
import { getManifest } from '@/lib/server/manifest-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = await getManifest(searchParams.get('product') ?? undefined, searchParams.get('version') ?? undefined);
  return ok(data);
}

