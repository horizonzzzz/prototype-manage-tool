import { redirect } from 'next/navigation';

import { PreviewBrowser } from '@/components/preview-browser';
import { buildPreviewHref } from '@/lib/ui/navigation';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewVersionRouteProps = {
  params: Promise<{ productKey: string; version: string }>;
};

export default async function PreviewVersionRoutePage({ params }: PreviewVersionRouteProps) {
  const { productKey, version } = await params;
  const manifest = await getManifest(productKey, version);

  if (!manifest.resolved.productKey || !manifest.resolved.version) {
    redirect('/preview');
  }

  const canonicalHref = buildPreviewHref(manifest.resolved.productKey, manifest.resolved.version);
  const currentHref = buildPreviewHref(productKey, version);

  if (canonicalHref !== currentHref) {
    redirect(canonicalHref);
  }

  return (
    <PreviewBrowser
      products={manifest.products}
      selectedProductKey={manifest.resolved.productKey}
      selectedVersion={manifest.resolved.version}
    />
  );
}
