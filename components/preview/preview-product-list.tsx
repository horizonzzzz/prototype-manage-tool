'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PreviewEmptyState } from '@/components/preview/preview-empty-state';
import { PreviewProductCard } from '@/components/preview/preview-product-card';
import { PreviewViewerDialog } from '@/components/preview/preview-viewer-dialog';
import { Input } from '@/components/ui/input';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';
import {
  createPreviewVersionSelections,
  filterPreviewProducts,
  findPreviewVersion,
  syncPreviewVersionSelections,
} from '@/lib/ui/preview-product-list-view';
import { buildPreviewStateHref, resolvePreviewViewerState } from '@/lib/ui/preview-viewer-state';

type PreviewProductListProps = {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
};

export function PreviewProductList({ products, selectedProductKey, selectedVersion }: PreviewProductListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [versionSelections, setVersionSelections] = useState<Record<string, string | undefined>>(() =>
    createPreviewVersionSelections(products, selectedProductKey, selectedVersion),
  );
  const deferredSearch = useDeferredValue(search);

  const filteredProducts = useMemo(() => filterPreviewProducts(products, deferredSearch), [deferredSearch, products]);
  const viewerState = useMemo(
    () => resolvePreviewViewerState(products, selectedProductKey, selectedVersion),
    [products, selectedProductKey, selectedVersion],
  );
  const viewerProduct = viewerState.productKey ? products.find((item) => item.key === viewerState.productKey) : undefined;
  const viewerVersion = viewerProduct ? findPreviewVersion(viewerProduct, viewerState.version) : undefined;

  useEffect(() => {
    setVersionSelections((current) => syncPreviewVersionSelections(current, products, selectedProductKey, selectedVersion));
  }, [products, selectedProductKey, selectedVersion]);

  const resolveTarget = (version: ProductVersionManifest | undefined) =>
    version?.entryUrl && typeof window !== 'undefined'
      ? resolvePreviewEntryUrl(version.entryUrl, window.location.origin)
      : undefined;

  const openViewer = (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version) return;
    router.push(buildPreviewStateHref(productKey, version.version), { scroll: false });
  };

  const openPreviewInNewWindow = (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version || typeof window === 'undefined') return;
    const target = new URL(buildPreviewStateHref(productKey, version.version), window.location.origin).toString();
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const copyPreviewLink = async (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version || typeof window === 'undefined') return;
    const copied = await copyText(new URL(buildPreviewStateHref(productKey, version.version), window.location.origin).toString());
    copied ? toast.success('预览链接已复制') : toast.error('当前环境不支持自动复制，请手动复制');
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">产品预览</h2>
          <p className="text-muted-foreground">查看和分享已发布的原型版本。</p>
        </div>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索产品名称或 Key" className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        {filteredProducts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const selectedRowVersion = findPreviewVersion(product, versionSelections[product.key]);

              return (
                <PreviewProductCard
                  key={product.key}
                  product={product}
                  selectedVersion={selectedRowVersion}
                  onVersionChange={(value) => setVersionSelections((current) => ({ ...current, [product.key]: value }))}
                  onOpenViewer={() => openViewer(product.key, selectedRowVersion)}
                  onCopyLink={() => void copyPreviewLink(product.key, selectedRowVersion)}
                  onOpenInNewWindow={() => openPreviewInNewWindow(product.key, selectedRowVersion)}
                />
              );
            })}
          </div>
        ) : (
          <PreviewEmptyState onGoToAdmin={() => router.push('/admin')} />
        )}
      </div>

      <PreviewViewerDialog
        open={viewerState.isOpen}
        productName={viewerProduct?.name}
        version={viewerVersion}
        targetUrl={resolveTarget(viewerVersion)}
        onOpenChange={(open) => {
          if (!open) {
            router.push(buildPreviewStateHref(), { scroll: false });
          }
        }}
        onOpenInNewWindow={() => openPreviewInNewWindow(viewerProduct?.key ?? '', viewerVersion)}
      />
    </>
  );
}
