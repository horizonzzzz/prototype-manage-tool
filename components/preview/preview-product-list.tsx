'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, MonitorPlay, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PreviewViewerDialog } from '@/components/preview/preview-viewer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';
import { filterPreviewProducts, resolveInitialPreviewVersion } from '@/lib/ui/preview-product-list-view';
import { buildPreviewStateHref, resolvePreviewViewerState } from '@/lib/ui/preview-viewer-state';

type PreviewProductListProps = {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
};

function resolveVersionSelection(product: ManifestProduct, selectedProductKey?: string, selectedVersion?: string) {
  return resolveInitialPreviewVersion(product, product.key === selectedProductKey ? selectedVersion : undefined);
}

function findSelectedVersion(product: ManifestProduct, selectedVersion?: string) {
  return product.versions.find((item) => item.version === selectedVersion) ?? product.versions[0];
}

export function PreviewProductList({ products, selectedProductKey, selectedVersion }: PreviewProductListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [versionSelections, setVersionSelections] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(products.map((product) => [product.key, resolveVersionSelection(product, selectedProductKey, selectedVersion)])),
  );
  const deferredSearch = useDeferredValue(search);

  const filteredProducts = useMemo(() => filterPreviewProducts(products, deferredSearch), [deferredSearch, products]);
  const viewerState = useMemo(
    () => resolvePreviewViewerState(products, selectedProductKey, selectedVersion),
    [products, selectedProductKey, selectedVersion],
  );
  const viewerProduct = viewerState.productKey ? products.find((item) => item.key === viewerState.productKey) : undefined;
  const viewerVersion = viewerProduct ? findSelectedVersion(viewerProduct, viewerState.version) : undefined;

  useEffect(() => {
    setVersionSelections((current) => ({
      ...current,
      ...Object.fromEntries(
        products.map((product) => [
          product.key,
          resolveVersionSelection(product, product.key === selectedProductKey ? selectedVersion : current[product.key]),
        ]),
      ),
    }));
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
              const selectedRowVersion = findSelectedVersion(product, versionSelections[product.key]);
              const summary = product.description || '暂无描述';

              return (
                <Card key={product.key} className="flex h-full flex-col overflow-hidden transition-all hover:shadow-md">
                  <CardHeader className="bg-slate-50/50 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-xl">{product.name}</CardTitle>
                        <CardDescription className="mt-1 truncate font-mono text-xs">{product.key}</CardDescription>
                      </div>
                      {product.versions.length ? (
                        <Select value={selectedRowVersion?.version} onValueChange={(value) => setVersionSelections((current) => ({ ...current, [product.key]: value }))}>
                          <SelectTrigger size="sm" className="w-[100px] bg-white text-xs">
                            <SelectValue className="block truncate text-left" placeholder="选择版本" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.versions.map((version) => (
                              <SelectItem key={version.version} value={version.version}>
                                v{version.version}{version.isDefault ? '（默认）' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">无可用版本</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 pt-4">
                    <p className="line-clamp-2 text-sm text-slate-600">{summary}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <span>已发布 {product.versions.length} 个版本</span>
                      {selectedRowVersion ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>当前选中: v{selectedRowVersion.version}</span>
                        </>
                      ) : null}
                    </div>
                  </CardContent>

                  <CardFooter className="gap-2 border-t bg-slate-50/50 p-4">
                    <Button type="button" className="flex-1" disabled={!selectedRowVersion} onClick={() => openViewer(product.key, selectedRowVersion)}>
                      <MonitorPlay className="mr-2 h-4 w-4" />
                      预览
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!selectedRowVersion}
                      onClick={() => void copyPreviewLink(product.key, selectedRowVersion)}
                      title="复制预览链接"
                      aria-label="复制预览链接"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!selectedRowVersion}
                      onClick={() => openPreviewInNewWindow(product.key, selectedRowVersion)}
                      title="新窗口预览"
                      aria-label="新窗口预览"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 px-6 text-center">
            <MonitorPlay className="mb-4 h-12 w-12 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900">暂无产品</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">请先在发布管理台中创建产品并发布版本。</p>
            <Button type="button" variant="outline" className="mt-5" onClick={() => router.push('/admin')}>
              前往发布管理
            </Button>
          </div>
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
