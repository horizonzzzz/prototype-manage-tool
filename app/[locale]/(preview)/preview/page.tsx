import { PreviewProductList } from '@/components/preview/preview-product-list';
import { getManifest } from '@/lib/server/manifest-service';
import { requirePageUser } from '@/lib/server/session-user';
import { getLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function PreviewPage() {
  const locale = await getLocale();
  const user = await requirePageUser(locale);
  const manifest = await getManifest(user.id);

  return <PreviewProductList products={manifest.products} />;
}
