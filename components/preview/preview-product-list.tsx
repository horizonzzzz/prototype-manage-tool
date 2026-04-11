'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { PreviewEmptyState } from '@/components/preview/preview-empty-state';
import { PreviewProductCard } from '@/components/preview/preview-product-card';
import { PreviewViewerDialog } from '@/components/preview/preview-viewer-dialog';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';
import {
  createPreviewVersionSelections,
  filterPreviewProducts,
  findPreviewVersion,
  syncPreviewVersionSelections,
} from '@/lib/ui/preview-product-list-view';
import { buildLocalizedPreviewStateHref, buildPreviewStateHref, resolvePreviewViewerState } from '@/lib/ui/preview-viewer-state';

type PreviewProductListProps = {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
};

export function PreviewProductList({ products, selectedProductKey, selectedVersion }: PreviewProductListProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations('preview.list');
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

  const resolvePreviewStateUrl = (productKey: string, version: ProductVersionManifest | undefined) =>
    buildLocalizedPreviewStateHref(locale, productKey, version?.version);

  const openViewer = (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version) return;
    router.push(buildPreviewStateHref(productKey, version.version), { scroll: false });
  };

  const openPreviewInNewWindow = (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version || typeof window === 'undefined') return;
    const target = new URL(resolvePreviewStateUrl(productKey, version), window.location.origin).toString();
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const copyPreviewLink = async (productKey: string, version: ProductVersionManifest | undefined) => {
    if (!version || typeof window === 'undefined') return;
    const copied = await copyText(new URL(resolvePreviewStateUrl(productKey, version), window.location.origin).toString());
    copied ? toast.success(t('copied')) : toast.error(t('copyFailed'));
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('searchPlaceholder')} className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} />
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
