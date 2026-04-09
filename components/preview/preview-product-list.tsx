'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { StandardTablePage } from '@/components/standard-table-page';
import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';
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
  if (product.key === selectedProductKey && selectedVersion && product.versions.some((item) => item.version === selectedVersion)) {
    return selectedVersion;
  }

  return product.defaultVersion ?? product.versions[0]?.version;
}

function findSelectedVersion(product: ManifestProduct, selectedVersion?: string) {
  return product.versions.find((item) => item.version === selectedVersion) ?? product.versions[0];
}

export function PreviewProductList({ products, selectedProductKey, selectedVersion }: PreviewProductListProps) {
  const [search, setSearch] = useState('');
  const [versionSelections, setVersionSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((product) => [product.key, resolveVersionSelection(product, selectedProductKey, selectedVersion)]),
    ),
  );
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredProducts = useMemo(() => {
    if (!deferredSearch) {
      return products;
    }

    return products.filter((product) => [product.name, product.key].some((value) => value.toLowerCase().includes(deferredSearch)));
  }, [deferredSearch, products]);

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
      description="按产品查看已发布原型，并在表格行内切换版本、打开预览和复制地址。"
      tableTitle="产品列表"
      tableDescription="每行对应一个产品，版本通过下拉切换，操作在右侧统一管理。"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索产品名称或 Key"
    >
      {filteredProducts.length ? (
        <div className="overflow-hidden rounded-b-[18px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[28%]">产品名称</TableHead>
                <TableHead className="w-[14%]">产品 Key</TableHead>
                <TableHead className="w-[24%]">当前版本</TableHead>
                <TableHead className="w-[12%]">已发布版本</TableHead>
                <TableHead className="w-[12%]">创建时间</TableHead>
                <TableHead className="w-[18%]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const selectedRowVersion = findSelectedVersion(product, versionSelections[product.key]);

                return (
                  <TableRow key={product.key}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900">{product.name}</div>
                        <div className="text-sm text-slate-500">
                          默认版本：{product.defaultVersion ?? '—'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full border border-[color:var(--border)] bg-slate-50 px-3 py-1 font-mono text-[12px] text-slate-600">
                        {product.key}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-3">
                        <Select value={selectedRowVersion?.version} onValueChange={(value) => updateSelectedVersion(product.key, value)}>
                          <SelectTrigger className="h-10 shadow-none">
                            <SelectValue placeholder="选择版本" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.versions.map((version) => (
                              <SelectItem key={version.version} value={version.version}>
                                {version.version}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedRowVersion ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedRowVersion.isDefault ? <StatusChip status="offline" label="默认版本" /> : null}
                            {selectedRowVersion.isLatest ? <StatusChip status="running" label="最新版本" /> : null}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{product.versions.length}</TableCell>
                    <TableCell className="text-xs leading-5 text-slate-500">{formatDateTime(product.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => openPreview(selectedRowVersion)} disabled={!selectedRowVersion}>
                          <ExternalLink />
                          预览
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void copyPreviewLink(selectedRowVersion)} disabled={!selectedRowVersion}>
                          <Copy />
                          复制链接
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">暂无可预览产品</div>
      )}
    </StandardTablePage>
  );
}
