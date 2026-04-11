import { getLocale } from 'next-intl/server';

import { redirect } from '@/i18n/navigation';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewVersionRouteProps = {
  params: Promise<{ productKey: string; version: string }>;
};

export default async function PreviewVersionRoutePage({ params }: PreviewVersionRouteProps) {
  const locale = await getLocale();
  const { productKey, version } = await params;

  if (!isSafeRouteSegment(productKey) || !isSafeRouteSegment(version)) {
    redirect({ href: '/preview', locale });
  }

  const manifest = await getManifest(productKey, version);

  if (!manifest.resolved.productKey || manifest.resolved.productKey !== productKey || !manifest.resolved.version) {
    redirect({ href: '/preview', locale });
  }

  redirect({ href: buildPreviewStateHref(productKey, manifest.resolved.version), locale });
}
