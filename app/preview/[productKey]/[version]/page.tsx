import { redirect } from 'next/navigation';

import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewVersionRouteProps = {
  params: Promise<{ productKey: string; version: string }>;
};

export default async function PreviewVersionRoutePage({ params }: PreviewVersionRouteProps) {
  const { productKey, version } = await params;

  if (!isSafeRouteSegment(productKey) || !isSafeRouteSegment(version)) {
    redirect('/preview');
  }

  const manifest = await getManifest(productKey, version);

  if (!manifest.resolved.productKey || manifest.resolved.productKey !== productKey || !manifest.resolved.version) {
    redirect('/preview');
  }

  redirect(buildPreviewStateHref(productKey, manifest.resolved.version));
}
