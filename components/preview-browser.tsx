'use client';

import { useMemo } from 'react';
import { Copy, ExternalLink, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/status-chip';
import { VersionPillBar } from '@/components/version-pill-bar';
import type { ManifestProduct } from '@/lib/types';
import { groupVersionsForPreview } from '@/lib/domain/preview';
import { buildPreviewHref } from '@/lib/ui/navigation';
import { copyText, resolvePreviewEntryUrl } from '@/lib/ui/preview-link';

type PreviewBrowserProps = {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
};

export function PreviewBrowser({ products, selectedProductKey, selectedVersion }: PreviewBrowserProps) {
  const router = useRouter();

  const currentProduct = products.find((item) => item.key === selectedProductKey);
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
    <div className="space-y-5">
      <section className="flex items-start justify-between gap-5 rounded-[24px] border border-[color:var(--border-strong)] bg-white/88 px-6 py-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">前端原型统一预览台</h2>
          <p className="mt-1 text-sm text-slate-500">按产品 / 版本切换预览</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </section>

      <section className="rounded-[24px] border border-[color:var(--border-strong)] bg-white/88 px-6 py-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
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
        </div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[color:var(--border-strong)] bg-white/98 shadow-[var(--shadow-panel)]">
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
  );
}
