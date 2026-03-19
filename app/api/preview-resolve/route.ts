import { fail, ok } from '@/lib/api';
import { getManifest } from '@/lib/server/manifest-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const manifest = await getManifest(searchParams.get('product') ?? undefined, searchParams.get('version') ?? undefined);

  if (!manifest.resolved.productKey || !manifest.resolved.version) {
    return fail('No published version available', 404);
  }

  const product = manifest.products.find((item) => item.key === manifest.resolved.productKey)!;
  const version = product.versions.find((item) => item.version === manifest.resolved.version)!;

  return ok({
    productKey: product.key,
    version: version.version,
    entryUrl: version.entryUrl,
  });
}

