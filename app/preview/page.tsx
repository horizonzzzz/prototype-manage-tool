import { redirect } from 'next/navigation';

import { PreviewProductList } from '@/components/preview/preview-product-list';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildPreviewHref } from '@/lib/ui/navigation';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const product = takeFirst(resolvedSearchParams?.product);
  const version = takeFirst(resolvedSearchParams?.version);

  if (product && isSafeRouteSegment(product) && (!version || isSafeRouteSegment(version))) {
    redirect(buildPreviewHref(product, version));
  }

  const manifest = await getManifest();

  return <PreviewProductList products={manifest.products} />;
}
