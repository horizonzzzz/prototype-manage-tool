import React from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { PreviewProductList } from '@/components/preview/preview-product-list';
import { Button } from '@/components/ui/button';
import { Link, redirect } from '@/i18n/navigation';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
import { getManifest } from '@/lib/server/manifest-service';

export const dynamic = 'force-dynamic';

type PreviewProductRouteProps = {
  params: Promise<{ productKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PreviewProductRoutePage({ params, searchParams }: PreviewProductRouteProps) {
  const locale = await getLocale();
  const t = await getTranslations('preview.missingProduct');
  const { productKey } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedVersion = takeFirst(resolvedSearchParams?.v) ?? takeFirst(resolvedSearchParams?.version);

  if (!isSafeRouteSegment(productKey) || (requestedVersion && !isSafeRouteSegment(requestedVersion))) {
    redirect({ href: '/preview', locale });
  }

  const manifest = await getManifest(productKey, requestedVersion);

  if (!manifest.resolved.productKey || manifest.resolved.productKey !== productKey) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-50 text-center">
        <h2 className="text-2xl font-bold text-slate-800">{t('title')}</h2>
        <p className="mt-2 text-slate-500">{t('description', { productKey })}</p>
        <Button asChild className="mt-6">
          <Link href="/preview">{t('back')}</Link>
        </Button>
      </div>
    );
  }

  if (requestedVersion && manifest.resolved.version && requestedVersion !== manifest.resolved.version) {
    redirect({ href: buildPreviewStateHref(productKey, manifest.resolved.version), locale });
  }

  return (
    <PreviewProductList
      products={manifest.products}
      selectedProductKey={productKey}
      selectedVersion={manifest.resolved.version}
    />
  );
}
