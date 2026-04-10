import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PreviewProductList } from '@/components/preview/preview-product-list';
import { Button } from '@/components/ui/button';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildPreviewStateHref } from '@/lib/ui/preview-viewer-state';
import { getManifest } from '@/lib/server/manifest-service';

type PreviewProductRouteProps = {
  params: Promise<{ productKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PreviewProductRoutePage({ params, searchParams }: PreviewProductRouteProps) {
  const { productKey } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedVersion = takeFirst(resolvedSearchParams?.v) ?? takeFirst(resolvedSearchParams?.version);

  if (!isSafeRouteSegment(productKey) || (requestedVersion && !isSafeRouteSegment(requestedVersion))) {
    redirect('/preview');
  }

  const manifest = await getManifest(productKey, requestedVersion);

  if (!manifest.resolved.productKey || manifest.resolved.productKey !== productKey) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-50 text-center">
        <h2 className="text-2xl font-bold text-slate-800">产品不存在</h2>
        <p className="mt-2 text-slate-500">无法找到标识为 {productKey} 的产品</p>
        <Button asChild className="mt-6">
          <Link href="/preview">返回预览列表</Link>
        </Button>
      </div>
    );
  }

  if (requestedVersion && manifest.resolved.version && requestedVersion !== manifest.resolved.version) {
    redirect(buildPreviewStateHref(productKey, manifest.resolved.version));
  }

  return (
    <PreviewProductList
      products={manifest.products}
      selectedProductKey={productKey}
      selectedVersion={manifest.resolved.version}
    />
  );
}
