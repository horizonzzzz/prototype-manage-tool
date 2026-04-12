import { PreviewProductList } from '@/components/preview/preview-product-list';
import { getManifest } from '@/lib/server/manifest-service';

export const dynamic = 'force-dynamic';

export default async function PreviewPage() {
  const manifest = await getManifest();

  return <PreviewProductList products={manifest.products} />;
}
