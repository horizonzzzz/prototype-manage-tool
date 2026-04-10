import { redirect } from 'next/navigation';

import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
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

  const canonicalHref = buildPreviewStateHref(manifest.resolved.productKey, manifest.resolved.version);
  const currentHref = buildPreviewStateHref(productKey, version);

  if (canonicalHref !== currentHref) {
    redirect(canonicalHref);
  }

  redirect(canonicalHref);
}
