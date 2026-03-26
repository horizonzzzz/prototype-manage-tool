'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, RefreshCcw, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/status-chip';
import { VersionPillBar } from '@/components/version-pill-bar';
import type { ApiResponse, ManifestProduct } from '@/lib/types';
import { groupVersionsForPreview } from '@/lib/domain/preview';
import { buildAdminHref, buildPreviewHref } from '@/lib/ui/navigation';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';

type ManifestPayload = {
  products: ManifestProduct[];
  resolved: {
    productKey?: string;
    version?: string;
  };
};

async function fetchManifest(query: string) {
  const response = await fetch(`/api/manifest${query}`, { cache: 'no-store' });
  const payload = (await response.json()) as ApiResponse<ManifestPayload>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || '加载 manifest 失败');
  }

  return payload.data;
}

export function PreviewBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ManifestProduct[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [productKeyword, setProductKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = searchParams.toString();
    setLoading(true);
    fetchManifest(query ? `?${query}` : '')
      .then((data) => {
        setProducts(data.products);
        setSelectedProductKey(data.resolved.productKey);
        setSelectedVersion(data.resolved.version);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : '加载预览数据失败');
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const visibleProducts = useMemo(() => {
    const keyword = productKeyword.trim().toLowerCase();
    if (!keyword) {
      return products;
    }

    return products.filter((item) => [item.key, item.name].some((value) => value.toLowerCase().includes(keyword)));
  }, [productKeyword, products]);

  const currentProduct = products.find((item) => item.key === selectedProductKey) ?? visibleProducts[0];
  const versions = currentProduct?.versions ?? [];
  const currentVersion =
    versions.find((item) => item.version === selectedVersion) ??
    versions.find((item) => item.version === currentProduct?.defaultVersion) ??
    versions[0];

  const groupedVersions = useMemo(
    () => groupVersionsForPreview(versions, currentVersion?.version),
    [currentVersion?.version, versions],
  );

  const syncUrl = (productKey: string, version: string) => {
    setSelectedProductKey(productKey);
    setSelectedVersion(version);
    router.replace(buildPreviewHref(productKey, version));
  };

  const resolveCurrentPreviewLink = () => {
    if (!currentVersion?.entryUrl || typeof window === 'undefined') {
      return undefined;
    }

    return resolvePreviewEntryUrl(currentVersion.entryUrl, window.location.origin);
  };

  const copyLink = async () => {
    if (!currentProduct || !currentVersion) {
      return;
    }

    const target = resolveCurrentPreviewLink();
    if (!target) {
      return;
    }

    const copied = await copyText(target);
    if (copied) {
      toast.success('预览页链接已复制');
      return;
    }

    toast.error('当前环境不支持自动复制，请手动复制预览地址');
  };

  const openNewWindow = () => {
    const target = resolveCurrentPreviewLink();
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="w-[264px] shrink-0 border-r border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/82 backdrop-blur-xl">
        <div className="flex h-full flex-col gap-4 px-[18px] py-5">
          <div>
            <h1 className="mb-3 text-base font-semibold text-slate-900">产品原型</h1>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={productKeyword}
                onChange={(event) => setProductKeyword(event.target.value)}
                className="pl-9"
                placeholder="按产品名称搜索"
              />
            </div>
          </div>

          <ul className="space-y-2">
            {visibleProducts.map((item) => {
              const isSelected = item.key === currentProduct?.key;

              return (
                <li key={item.key} className="list-none">
                  <button
                    type="button"
                    className={`w-full rounded-[16px] border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-sky-200 bg-sky-50/92 shadow-[var(--shadow-soft)]'
                        : 'border-transparent hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white/82'
                    }`}
                    onClick={() => {
                      const nextVersion = item.defaultVersion ?? item.versions[0]?.version;
                      if (nextVersion) {
                        syncUrl(item.key, nextVersion);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.versions.length} 个已发布版本</div>
                      </div>
                      <span className="rounded-full border border-[color:var(--border)] bg-slate-50/90 px-2.5 py-1 font-mono text-[12px] text-slate-500">
                        {item.key}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {loading ? <div className="mt-2 h-20 animate-pulse rounded-[16px] bg-white/70" /> : null}
          {!loading && !visibleProducts.length ? (
            <div className="flex min-h-56 items-center justify-center rounded-[18px] border border-dashed border-[color:var(--border)] bg-white/70 px-4 text-sm text-slate-500">
              暂无可预览产品
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/80 px-7 py-5 backdrop-blur-xl">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">前端原型统一预览台</h2>
            <p className="mt-1 text-sm text-slate-500">按产品 / 版本切换预览</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push(buildAdminHref(currentProduct?.key))}>
              前往管理台
            </Button>
            <Button type="button" variant="secondary" onClick={() => void copyLink()} disabled={!currentVersion}>
              <Copy />
              复制预览链接
            </Button>
            <Button type="button" variant="secondary" onClick={openNewWindow} disabled={!currentVersion}>
              <ExternalLink />
              新窗口打开
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.refresh()}>
              <RefreshCcw />
              刷新
            </Button>
          </div>
        </header>

        <div className="space-y-5 px-7 py-6">
          <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
            <div>
              <h3 className="text-[17px] font-semibold text-slate-900">
                {currentProduct ? `${currentProduct.name} / 版本列表` : '暂无可预览版本'}
              </h3>
              <div className="mt-3">
                <div className="font-mono text-[15px] font-bold text-slate-900">{currentVersion?.version ?? '—'}</div>
                <div className="mt-1 text-sm text-slate-500">{currentVersion?.remark || '暂无更新说明'}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {currentVersion?.isDefault ? <StatusChip status="offline" label="默认版本" /> : null}
                  {currentVersion?.isLatest ? <StatusChip status="running" label="最新记录" /> : null}
                </div>
              </div>
            </div>

            {currentProduct ? (
              <VersionPillBar
                currentVersion={currentVersion?.version}
                visibleVersions={groupedVersions.visibleVersions}
                overflowVersions={groupedVersions.overflowVersions}
                onSelect={(version) => syncUrl(currentProduct.key, version)}
              />
            ) : null}
          </section>

          <section className="overflow-hidden rounded-[22px] border border-[color:var(--border-strong)] bg-white/98 shadow-[var(--shadow-panel)]">
            <div className="flex items-center gap-3 border-b border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
              </div>
              <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-slate-50/92 px-3 py-1 font-mono text-[11px] text-slate-500">
                <span className="size-2 rounded-full bg-emerald-400" />
                Preview Active
              </div>
            </div>

            {currentVersion?.entryUrl ? (
              <iframe className="min-h-[72vh] w-full border-none bg-white" src={currentVersion.entryUrl} title={`${currentProduct?.name}-${currentVersion.version}`} />
            ) : (
              <div className="flex min-h-[72vh] items-center justify-center bg-white/95 px-6 text-sm text-slate-500">暂无可预览版本</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
