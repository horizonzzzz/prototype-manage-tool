import { redirect } from 'next/navigation';

import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewProductRouteProps = {
  params: Promise<{ productKey: string }>;
};

export default async function PreviewProductRoutePage({ params }: PreviewProductRouteProps) {
  const { productKey } = await params;
  const manifest = await getManifest(productKey);

  if (!manifest.resolved.productKey || !manifest.resolved.version) {
    redirect('/preview');
  }

  redirect(buildPreviewStateHref(manifest.resolved.productKey, manifest.resolved.version));
}
