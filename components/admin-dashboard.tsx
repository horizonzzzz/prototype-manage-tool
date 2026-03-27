'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Play, Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { AdminProductListItem } from '@/components/admin-product-list-item';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PanelCard } from '@/components/panel-card';
import { ProductCreateDialog } from '@/components/admin/product-create-dialog';
import { UploadVersionForm } from '@/components/admin/upload-version-form';
import { CurrentJobContent } from '@/components/admin/current-job-content';
import { VersionListContent } from '@/components/admin/version-list-content';
import { RecentJobsContent } from '@/components/admin/recent-jobs-content';
import { ProductInfoContent } from '@/components/admin/product-info-content';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProductSchema, type CreateProductFormValues, type UploadFormValues, uploadFormSchema } from '@/components/admin/form-schemas';
import { getErrorMessage } from '@/lib/domain/error-message';
import type {
  ApiResponse,
  BuildJobItem,
  BuildJobLogItem,
  BuildJobLogStreamEvent,
  BuildJobStepKey,
  ProductDetail,
  ProductListItem,
  ProductVersionItem,
} from '@/lib/types';
import { buildPreviewHref, resolveAdminProductKey } from '@/lib/ui/navigation';
import {
  applyBuildJobLogStreamEvent,
  buildBuildJobLogStreamUrl,
  buildBuildJobStageText,
  getBuildJobLogStep,
  isBuildJobLogStreamStep,
  shouldStreamBuildJobLog,
} from '@/lib/ui/build-job-log';

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data as T;
}

function getTerminalEmptyText(activeJob: BuildJobItem | null) {
  return activeJob ? activeJob.logSummary || 'No terminal output for the current step.' : 'Waiting for build job selection...';
}

function triggerVersionDownload(versionId: number) {
  if (typeof document === 'undefined') {
    return;
  }

  const link = document.createElement('a');
  link.href = `/api/versions/${versionId}/download`;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
}

export function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState<string>();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [activeJobLog, setActiveJobLog] = useState<BuildJobLogItem | null>(null);
  const [selectedLogStepKey, setSelectedLogStepKey] = useState<BuildJobStepKey | null>(null);
  const [isLogStepPinned, setIsLogStepPinned] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'product' | 'version' | null>(null);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { version: '', title: '', remark: '' },
  });
  const productForm = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { key: '', name: '', description: '' },
  });

  const clearProductContext = () => {
    setProductDetail(null);
    setJobs([]);
    setActiveJobId(undefined);
    setActiveJob(null);
    setActiveJobLog(null);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
  };

  const syncJobs = (nextJobs: BuildJobItem[]) => {
    setJobs(nextJobs);
    const runningJob = nextJobs.find((item) => ['queued', 'running'].includes(item.status));
    if (runningJob) {
      setActiveJobId(runningJob.id);
      setActiveJob(runningJob);
      return;
    }

    setActiveJob((current) => (current ? nextJobs.find((item) => item.id === current.id) ?? current : null));
    if (activeJobId && !nextJobs.some((item) => item.id === activeJobId)) {
      setActiveJobId(undefined);
    }
  };

  const loadProducts = async () => setProducts(await fetchJson<ProductListItem[]>('/api/products'));

  const replaceProductQuery = (productKey?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    productKey ? next.set('product', productKey) : next.delete('product');
    const currentQuery = searchParams.toString();
    const nextQuery = next.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (currentUrl !== nextUrl) {
      router.replace(nextUrl);
    }
  };

  const loadProductDetail = async (productKey: string) => {
    setLoading(true);
    try {
      const [detail, buildJobs] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${productKey}`),
        fetchJson<BuildJobItem[]>(`/api/products/${productKey}/build-jobs`),
      ]);
      setProductDetail(detail);
      syncJobs(buildJobs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts().catch((error) => toast.error(getErrorMessage(error, '加载产品列表失败')));
  }, []);

  useEffect(() => {
    const resolvedProductKey = resolveAdminProductKey(products.map((item) => item.key), searchParams.get('product'));
    setSelectedProductKey((current) => (current === resolvedProductKey ? current : resolvedProductKey));
    if (resolvedProductKey !== searchParams.get('product')) {
      replaceProductQuery(resolvedProductKey);
    }
  }, [products, searchParams]);

  useEffect(() => {
    if (!selectedProductKey) {
      clearProductContext();
      return;
    }
    void loadProductDetail(selectedProductKey).catch((error) => toast.error(getErrorMessage(error, '加载产品详情失败')));
  }, [selectedProductKey]);

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const job = await fetchJson<BuildJobItem>(`/api/build-jobs/${activeJobId}`);
        if (cancelled) return;
        setActiveJob(job);
        setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
        if (!['queued', 'running'].includes(job.status)) {
          window.clearInterval(timer);
          if (selectedProductKey === job.productKey) await loadProductDetail(job.productKey);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, selectedProductKey]);

  useEffect(() => {
    if (!activeJob) {
      setSelectedLogStepKey(null);
      setIsLogStepPinned(false);
      return;
    }
    const currentStep = getBuildJobLogStep(activeJob.currentStep);
    if (!isLogStepPinned || !selectedLogStepKey) {
      setSelectedLogStepKey(currentStep);
      return;
    }
    if (!activeJob.steps.some((step) => step.key === selectedLogStepKey)) {
      setSelectedLogStepKey(currentStep);
      setIsLogStepPinned(false);
    }
  }, [activeJob, isLogStepPinned, selectedLogStepKey]);

  useEffect(() => {
    if (!activeJobId || !activeJob) {
      setActiveJobLog(null);
      return;
    }
    const logStep = selectedLogStepKey ? getBuildJobLogStep(selectedLogStepKey) : getBuildJobLogStep(activeJob.currentStep);
    if (!logStep) return setActiveJobLog(null);

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;
    const loadLog = async () => {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${activeJobId}/logs?step=${logStep}`);
        if (!cancelled) setActiveJobLog(payload);
      } catch {
        if (!cancelled) setActiveJobLog({ step: logStep, content: '', exists: false, updatedAt: null });
      }
    };
    if (shouldStreamBuildJobLog(activeJob, logStep) && isBuildJobLogStreamStep(logStep) && typeof EventSource !== 'undefined') {
      const connectStream = async () => {
        await loadLog();
        if (cancelled) return;
        eventSource = new EventSource(buildBuildJobLogStreamUrl(activeJobId, logStep));
        const handleStreamEvent = (messageEvent: MessageEvent<string>) => {
          if (cancelled) return;
          const event = JSON.parse(messageEvent.data) as BuildJobLogStreamEvent;
          setActiveJobLog((current) => applyBuildJobLogStreamEvent(current, event));
          if (event.type === 'status' && event.done) {
            eventSource?.close();
            eventSource = null;
          }
        };
        eventSource.addEventListener('snapshot', handleStreamEvent as EventListener);
        eventSource.addEventListener('chunk', handleStreamEvent as EventListener);
        eventSource.addEventListener('status', handleStreamEvent as EventListener);
        eventSource.addEventListener('heartbeat', handleStreamEvent as EventListener);
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      };
      void connectStream();
      return () => {
        cancelled = true;
        eventSource?.close();
      };
    }
    void loadLog();
    if (['queued', 'running'].includes(activeJob.status)) {
      timer = window.setInterval(() => void loadLog(), 1500);
    }
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      eventSource?.close();
    };
  }, [activeJob, activeJobId, selectedLogStepKey]);

  const filteredVersions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const source = productDetail?.versions ?? [];
    return !keyword ? source : source.filter((item) => [item.version, item.title ?? '', item.remark ?? ''].some((value) => value.toLowerCase().includes(keyword)));
  }, [productDetail, search]);

  const createProduct = productForm.handleSubmit(async (values) => {
    try {
      await fetchJson('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      toast.success('产品创建成功');
      setCreateOpen(false);
      productForm.reset();
      await loadProducts();
    } catch (error) {
      toast.error(getErrorMessage(error, '产品创建失败'));
    }
  });

  const uploadVersion = uploadForm.handleSubmit(async (values) => {
    try {
      setUploadError(undefined);
      if (!selectedProductKey) return setUploadError('请先选择产品');
      if (!selectedUploadFile) return setUploadError('请上传源码压缩包');
      setUploading(true);
      const formData = new FormData();
      formData.set('productKey', selectedProductKey);
      formData.set('version', values.version);
      formData.set('title', values.title ?? '');
      formData.set('remark', values.remark ?? '');
      formData.set('file', selectedUploadFile);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/versions/upload');
        xhr.upload.onprogress = (event) => event.lengthComputable && setUploadProgress(Math.round((event.loaded / event.total) * 100));
        xhr.onload = async () => {
          const payload = JSON.parse(xhr.responseText) as ApiResponse<BuildJobItem>;
          if (xhr.status >= 400 || !payload.success || !payload.data) return reject(new Error(payload.message || '上传失败'));
          toast.success('源码包上传成功，后台任务已开始');
          uploadForm.reset();
          setSelectedUploadFile(null);
          setActiveJobId(payload.data.id);
          setActiveJob(payload.data);
          setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
          setIsLogStepPinned(false);
          await loadProducts();
          await loadProductDetail(selectedProductKey);
          resolve();
        };
        xhr.onerror = () => reject(new Error('上传失败'));
        xhr.send(formData);
      });
    } catch (error) {
      const message = getErrorMessage(error, '上传失败');
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  });

  const refreshCurrent = async () => selectedProductKey && (await loadProducts(), await loadProductDetail(selectedProductKey));
  const requestAction = async (url: string, successText: string) => {
    await fetchJson(url, { method: url.includes('/default') || url.includes('/offline') ? 'PATCH' : 'DELETE' });
    toast.success(successText);
    await refreshCurrent();
  };

  const selectedStep = activeJob?.steps.find((step) => step.key === selectedLogStepKey) ?? null;
  const terminalContent = activeJobLog?.exists ? activeJobLog.content : activeJob && selectedStep ? buildBuildJobStageText(activeJob, selectedStep) : '';

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="w-[288px] shrink-0 border-r border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/82 backdrop-blur-xl">
        <div className="flex h-full flex-col gap-4 px-[18px] py-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base font-semibold text-slate-900">产品列表</h1>
            <Button type="button" className="h-10 px-4" onClick={() => setCreateOpen(true)}><Plus />新建</Button>
          </div>
          <ul className="space-y-2">
            {products.map((item) => (
              <AdminProductListItem key={item.id} item={item} selected={item.key === selectedProductKey} onSelect={(productKey) => { setSelectedProductKey(productKey); replaceProductQuery(productKey); }} onDelete={setProductToDelete} />
            ))}
          </ul>
          {!products.length && !loading ? <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-dashed border-[color:var(--border)] bg-white/70 px-4 text-sm text-slate-500">暂无产品</div> : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/80 px-7 py-5 backdrop-blur-xl">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">原型发布管理台</h2>
            <p className="mt-1 text-sm text-slate-500">上传源码压缩包，系统自动安装依赖、执行构建并发布 dist</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => router.push(buildPreviewHref(selectedProductKey))}><Play />前往预览台</Button>
        </header>

        <div className="grid gap-6 px-7 py-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <PanelCard title="上传新版本" loading={loading && !productDetail}>
              <UploadVersionForm form={uploadForm} products={products} selectedProductKey={selectedProductKey} selectedUploadFile={selectedUploadFile} uploadError={uploadError} uploading={uploading} uploadProgress={uploadProgress} onProductChange={(productKey) => { setSelectedProductKey(productKey); replaceProductQuery(productKey); }} onFileChange={(file) => { setSelectedUploadFile(file); if (uploadError) setUploadError(undefined); }} onSubmit={uploadVersion} />
            </PanelCard>

            <PanelCard title="当前任务" loading={loading && !activeJob}>
              <CurrentJobContent activeJob={activeJob} selectedLogStepKey={selectedLogStepKey} terminalBadge={activeJobLog?.step ?? selectedLogStepKey ?? activeJob?.currentStep ?? 'status'} terminalContent={terminalContent} terminalEmptyText={getTerminalEmptyText(activeJob)} onSelectStep={(stepKey) => { setSelectedLogStepKey(stepKey); setIsLogStepPinned(true); }} />
            </PanelCard>

            <PanelCard title="版本列表" loading={loading && !productDetail} actions={<div className="relative w-[280px] max-w-full"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="搜索版本号或标题" /></div>}>
              <VersionListContent versions={filteredVersions} productDetail={productDetail} onPreview={(item) => productDetail && router.push(buildPreviewHref(productDetail.key, item.version))} onDownload={(item) => triggerVersionDownload(item.id)} onSetDefault={(item) => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')} onOffline={(item) => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')} onDelete={setVersionToDelete} />
            </PanelCard>
          </div>

          <div className="space-y-6">
            <PanelCard title="最近任务" loading={loading && !jobs.length}>
              <RecentJobsContent jobs={jobs} activeJobId={activeJob?.id} onSelect={(job) => { setActiveJobId(job.id); setActiveJob(job); }} />
            </PanelCard>

            <PanelCard title={<span className="flex items-center gap-2"><Info className="size-4 text-slate-400" />当前产品信息</span>} loading={loading && !productDetail}>
              <ProductInfoContent productDetail={productDetail} />
            </PanelCard>
          </div>
        </div>
      </main>

      <ProductCreateDialog open={createOpen} onOpenChange={setCreateOpen} form={productForm} onSubmit={createProduct} />

      <ConfirmDialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)} title={productToDelete ? `删除产品 ${productToDelete.name}` : '删除产品'} description="删除后会移除该产品下的所有版本、任务记录和已发布文件，请确认。" confirmLabel="删除" confirmVariant="destructive" pending={confirmingAction === 'product'} onConfirm={async () => {
        if (!productToDelete) return;
        try {
          setConfirmingAction('product');
          await fetchJson(`/api/products/${productToDelete.key}`, { method: 'DELETE' });
          toast.success('产品已删除');
          if (selectedProductKey === productToDelete.key) { setSelectedProductKey(undefined); clearProductContext(); }
          await loadProducts();
          setProductToDelete(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '产品删除失败'));
        } finally {
          setConfirmingAction(null);
        }
      }} />

      <ConfirmDialog open={Boolean(versionToDelete)} onOpenChange={(open) => !open && setVersionToDelete(null)} title={versionToDelete ? `删除版本 ${versionToDelete.version}` : '删除版本'} description="删除后会同步移除已发布目录，请确认。" confirmLabel="删除" confirmVariant="destructive" pending={confirmingAction === 'version'} onConfirm={async () => {
        if (!versionToDelete) return;
        try {
          setConfirmingAction('version');
          await requestAction(`/api/versions/${versionToDelete.id}`, '版本已删除');
          setVersionToDelete(null);
        } catch (error) {
          toast.error(getErrorMessage(error, '版本删除失败'));
        } finally {
          setConfirmingAction(null);
        }
      }} />
    </div>
  );
}
