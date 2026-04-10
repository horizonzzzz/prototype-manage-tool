'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Copy, ExternalLink, MonitorPlay } from 'lucide-react';
import { toast } from 'sonner';

import { StandardTablePage } from '@/components/standard-table-page';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';
import { filterPreviewProducts, resolveInitialPreviewVersion } from '@/lib/ui/preview-product-list-view';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';

interface PreviewProductListProps {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
}

function resolveVersionSelection(
  product: ManifestProduct,
  selectedProductKey?: string,
  selectedVersion?: string,
) {
  return resolveInitialPreviewVersion(product, product.key === selectedProductKey ? selectedVersion : undefined);
}

function findSelectedVersion(product: ManifestProduct, selectedVersion?: string) {
  return product.versions.find((item) => item.version === selectedVersion) ?? product.versions[0];
}

export function PreviewProductList({ products, selectedProductKey, selectedVersion }: PreviewProductListProps) {
  const [search, setSearch] = useState('');
  const [versionSelections, setVersionSelections] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(
      products.map((product) => [product.key, resolveVersionSelection(product, selectedProductKey, selectedVersion)]),
    ),
  );
  const deferredSearch = useDeferredValue(search);

  const filteredProducts = useMemo(() => filterPreviewProducts(products, deferredSearch), [deferredSearch, products]);
  const hasProducts = products.length > 0;

  const updateSelectedVersion = (productKey: string, nextVersion: string) => {
    setVersionSelections((current) => ({
      ...current,
      [productKey]: nextVersion,
    }));
  };

  const resolveTarget = (version: ProductVersionManifest | undefined) => {
    if (!version?.entryUrl || typeof window === 'undefined') {
      return undefined;
    }

    return resolvePreviewEntryUrl(version.entryUrl, window.location.origin);
  };

  const previewInCurrentTab = (version: ProductVersionManifest | undefined) => {
    const target = resolveTarget(version);
    if (target) {
      window.location.assign(target);
    }
  };

  const openPreview = (version: ProductVersionManifest | undefined) => {
    const target = resolveTarget(version);
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  const copyPreviewLink = async (version: ProductVersionManifest | undefined) => {
    const target = resolveTarget(version);
    if (!target) {
      return;
    }

    const copied = await copyText(target);
    if (copied) {
      toast.success('预览链接已复制');
      return;
    }

    toast.error('当前环境不支持自动复制，请手动复制');
  };

  return (
    <StandardTablePage
      title="前端原型统一预览台"
      description="按产品卡片浏览已发布原型，支持切换版本并执行预览、打开新窗口和复制链接。"
      tableTitle="产品预览列表"
      tableDescription="每张卡片对应一个产品，可独立选择版本并操作。"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索产品名称或 Key"
      contentClassName="px-6 py-6"
    >
      {filteredProducts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const selectedRowVersion = findSelectedVersion(product, versionSelections[product.key]);

            return (
              <Card key={product.key} className="flex h-full min-w-0 flex-col">
                <CardHeader className="flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="truncate text-base" title={product.name}>{product.name}</CardTitle>
                    <CardDescription className="truncate font-mono text-xs" title={product.key}>{product.key}</CardDescription>
                  </div>
                  {product.versions.length ? (
                    <div className="w-full sm:w-[188px] sm:shrink-0">
                      <Select value={selectedRowVersion?.version} onValueChange={(value) => updateSelectedVersion(product.key, value)}>
                        <SelectTrigger className="h-9 w-full min-w-0 shadow-none">
                          <SelectValue className="block truncate text-left" placeholder="选择版本" />
                        </SelectTrigger>
                        <SelectContent>
                          {product.versions.map((version) => (
                            <SelectItem key={version.version} value={version.version}>
                              <span className="block max-w-[220px] truncate" title={version.version}>{version.version}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </CardHeader>

                <CardContent className="flex flex-1 min-w-0 flex-col gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex max-w-full rounded-full border border-[color:var(--border)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                      <span className="truncate" title={`默认版本：${product.defaultVersion ?? '—'}`}>
                        默认版本：{product.defaultVersion ?? '—'}
                      </span>
                    </span>
                    {selectedRowVersion?.isDefault ? <StatusChip status="offline" label="默认版本" /> : null}
                    {selectedRowVersion?.isLatest ? <StatusChip status="running" label="最新版本" /> : null}
                  </div>

                  <div className="space-y-2 text-xs text-[color:var(--muted-foreground)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>当前版本</span>
                      <span className="max-w-[68%] truncate font-mono text-[13px] text-[color:var(--foreground)]" title={selectedRowVersion?.version ?? '—'}>
                        {selectedRowVersion?.version ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>已发布版本</span>
                      <span className="font-semibold text-[color:var(--foreground)]">{product.versions.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>创建时间</span>
                      <span className="max-w-[68%] truncate text-right" title={formatDateTime(product.createdAt)}>{formatDateTime(product.createdAt)}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-4">
                    <Button type="button" size="sm" onClick={() => previewInCurrentTab(selectedRowVersion)} disabled={!selectedRowVersion} className="flex-1 min-w-[112px]">
                      <MonitorPlay />
                      预览
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => openPreview(selectedRowVersion)} disabled={!selectedRowVersion} className="min-w-[112px]">
                      <ExternalLink />
                      打开
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void copyPreviewLink(selectedRowVersion)} disabled={!selectedRowVersion} className="min-w-[112px]">
                      <Copy />
                      复制链接
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/50 px-4 text-center">
          <MonitorPlay className="size-10 text-muted-foreground/60" />
          <p className="text-base font-semibold">{hasProducts ? '未找到匹配产品' : '暂无可预览产品'}</p>
          <p className="max-w-[460px] text-sm text-muted-foreground">
            {hasProducts
              ? '没有匹配当前搜索条件的产品，请调整关键词后重试。'
              : '请先在发布管理台创建产品并发布版本，然后在此处进行预览。'}
          </p>
        </div>
      )}
    </StandardTablePage>
  );
}
