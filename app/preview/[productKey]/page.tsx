import { redirect } from 'next/navigation';

import { buildPreviewHref } from '@/lib/ui/navigation';
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

  redirect(buildPreviewHref(manifest.resolved.productKey, manifest.resolved.version));
}
