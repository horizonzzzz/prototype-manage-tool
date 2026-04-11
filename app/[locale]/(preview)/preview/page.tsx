import { PreviewProductList } from '@/components/preview/preview-product-list';
import { getManifest } from '@/lib/server/manifest-service';

export default async function PreviewPage() {
  const manifest = await getManifest();

  return <PreviewProductList products={manifest.products} />;
}
