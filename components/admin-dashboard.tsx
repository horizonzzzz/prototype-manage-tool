'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Package2, Upload } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { BuildHistoryDrawer } from '@/components/admin/build-history-drawer';
import { UploadVersionDialog } from '@/components/admin/upload-version-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StandardTablePage } from '@/components/standard-table-page';
import { StatusChip } from '@/components/status-chip';
import { VersionListContent } from '@/components/admin/version-list-content';
import { Button } from '@/components/ui/button';
import { type UploadFormValues, uploadFormSchema } from '@/components/admin/form-schemas';
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
import { formatDateTime } from '@/lib/ui/format';
import { buildAdminHref, buildPreviewHref } from '@/lib/ui/navigation';
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
  return activeJob ? activeJob.logSummary || '当前步骤暂无日志输出' : '选择一条构建记录后查看日志';
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

export function AdminDashboard({ productKey }: { productKey: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductListItem[]>([]);
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<ProductVersionItem | null>(null);
  const [historyJobId, setHistoryJobId] = useState<number>();
  const [historyStepKey, setHistoryStepKey] = useState<BuildJobStepKey | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'version' | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { version: '', title: '', remark: '' },
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
    const fallbackJob = nextJobs[0];
    const nextActive = runningJob ?? (activeJobId ? nextJobs.find((item) => item.id === activeJobId) : undefined) ?? fallbackJob;

    setActiveJobId(nextActive?.id);
    setActiveJob(nextActive ?? null);
  };

  const loadProducts = async () => setProducts(await fetchJson<ProductListItem[]>('/api/products'));

  const loadProductDetail = async (targetProductKey: string) => {
    setLoading(true);
    try {
      const [detail, buildJobs] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${targetProductKey}`),
        fetchJson<BuildJobItem[]>(`/api/products/${targetProductKey}/build-jobs`),
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
    if (!productKey) {
      clearProductContext();
      return;
    }

    void loadProductDetail(productKey).catch((error) => toast.error(getErrorMessage(error, '加载产品详情失败')));
  }, [productKey]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const job = await fetchJson<BuildJobItem>(`/api/build-jobs/${activeJobId}`);
        if (cancelled) {
          return;
        }

        setActiveJob(job);
        setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
        if (!['queued', 'running'].includes(job.status)) {
          window.clearInterval(timer);
          if (productKey === job.productKey) {
            await loadProductDetail(job.productKey);
          }
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, productKey]);

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
    if (!logStep) {
      setActiveJobLog(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;
    const loadLog = async () => {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${activeJobId}/logs?step=${logStep}`);
        if (!cancelled) {
          setActiveJobLog(payload);
        }
      } catch {
        if (!cancelled) {
          setActiveJobLog({ step: logStep, content: '', exists: false, updatedAt: null });
        }
      }
    };

    if (shouldStreamBuildJobLog(activeJob, logStep) && isBuildJobLogStreamStep(logStep) && typeof EventSource !== 'undefined') {
      const connectStream = async () => {
        await loadLog();
        if (cancelled) {
          return;
        }

        eventSource = new EventSource(buildBuildJobLogStreamUrl(activeJobId, logStep));
        const handleStreamEvent = (messageEvent: MessageEvent<string>) => {
          if (cancelled) {
            return;
          }

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
      if (timer) {
        window.clearInterval(timer);
      }
      eventSource?.close();
    };
  }, [activeJob, activeJobId, selectedLogStepKey]);

  const filteredVersions = useMemo(() => {
    const source = productDetail?.versions ?? [];
    if (!deferredSearch) {
      return source;
    }

    return source.filter((item) =>
      [item.version, item.title ?? '', item.remark ?? '', item.status].some((value) => value.toLowerCase().includes(deferredSearch)),
    );
  }, [deferredSearch, productDetail]);

  const versionHistoryJobs = useMemo(() => {
    if (!historyVersion) {
      return [];
    }

    return jobs.filter((item) => item.version === historyVersion.version);
  }, [historyVersion, jobs]);

  const historyActiveJob = useMemo(() => {
    if (!versionHistoryJobs.length) {
      return null;
    }

    return versionHistoryJobs.find((item) => item.id === historyJobId) ?? versionHistoryJobs[0];
  }, [historyJobId, versionHistoryJobs]);

  const historySelectedStep = useMemo(() => {
    if (!historyActiveJob) {
      return null;
    }

    return historyActiveJob.steps.find((step) => step.key === historyStepKey) ?? historyActiveJob.steps[0] ?? null;
  }, [historyActiveJob, historyStepKey]);

  const refreshCurrent = async () => {
    if (!productKey) {
      return;
    }

    await loadProducts();
    await loadProductDetail(productKey);
  };

  const requestAction = async (url: string, successText: string) => {
    await fetchJson(url, { method: url.includes('/default') || url.includes('/offline') ? 'PATCH' : 'DELETE' });
    toast.success(successText);
    await refreshCurrent();
  };

  const uploadVersion = uploadForm.handleSubmit(async (values) => {
    try {
      setUploadError(undefined);
      if (!productKey) {
        setUploadError('请先选择产品');
        return;
      }
      if (!selectedUploadFile) {
        setUploadError('请上传源码压缩包');
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.set('productKey', productKey);
      formData.set('version', values.version);
      formData.set('title', values.title ?? '');
      formData.set('remark', values.remark ?? '');
      formData.set('file', selectedUploadFile);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/versions/upload');
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = async () => {
          const payload = JSON.parse(xhr.responseText) as ApiResponse<BuildJobItem>;
          if (xhr.status >= 400 || !payload.success || !payload.data) {
            reject(new Error(payload.message || '上传失败'));
            return;
          }

          toast.success('源码包上传成功，后台任务已开始');
          uploadForm.reset();
          setSelectedUploadFile(null);
          setActiveJobId(payload.data.id);
          setActiveJob(payload.data);
          setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
          setIsLogStepPinned(false);
          await loadProducts();
          await loadProductDetail(productKey);
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

  const selectedStep = activeJob?.steps.find((step) => step.key === selectedLogStepKey) ?? null;
  const terminalContent =
    activeJobLog?.exists && activeJobLog.content
      ? activeJobLog.content
      : activeJob && selectedStep
        ? buildBuildJobStageText(activeJob, selectedStep)
        : '';
  const terminalBadge = activeJobLog?.step ?? selectedLogStepKey ?? activeJob?.currentStep ?? 'status';

  return (
    <>
      <StandardTablePage
        title={productDetail?.name ?? productKey}
        description="当前页面只管理该产品的版本。上传、预览、下载、默认版本切换、下线和删除都在此完成。"
        tableTitle="版本列表"
        tableDescription="关键词支持按版本号、标题、备注和状态过滤。"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="搜索版本号、标题或状态"
        headerActions={
          <>
            <Button type="button" variant="secondary" onClick={() => router.push('/admin')}>
              <ArrowLeft />
              返回产品列表
            </Button>
            <Button type="button" onClick={() => setUploadDialogOpen(true)}>
              <Upload />
              上传版本
            </Button>
          </>
        }
        contentClassName="space-y-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] px-6 py-4 text-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-slate-50 px-3 py-1.5 font-mono text-[12px] text-slate-600">
            <Package2 className="size-3.5" />
            {productDetail?.key ?? productKey}
          </div>
          <div className="text-slate-500">
            创建时间：{productDetail ? formatDateTime(productDetail.createdAt) : '—'}
          </div>
          <div className="text-slate-500">
            已发布版本：<span className="font-semibold text-slate-900">{productDetail?.publishedCount ?? 0}</span>
          </div>
          {productDetail?.description ? <div className="text-slate-500">{productDetail.description}</div> : null}
        </div>

        <VersionListContent
          versions={filteredVersions}
          productDetail={productDetail}
          onPreview={(item) => productDetail && router.push(buildPreviewHref(productDetail.key, item.version))}
          onHistory={(item) => {
            const scopedJobs = jobs.filter((job) => job.version === item.version);
            setHistoryVersion(item);
            setHistoryDrawerOpen(true);
            if (scopedJobs.length) {
              const nextActive = scopedJobs.find((job) => job.id === activeJobId) ?? scopedJobs[0];
              setHistoryJobId(nextActive.id);
              setHistoryStepKey(getBuildJobLogStep(nextActive.currentStep));
            } else {
              setHistoryJobId(undefined);
              setHistoryStepKey(null);
            }
          }}
          onDownload={(item) => triggerVersionDownload(item.id)}
          onSetDefault={(item) => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}
          onOffline={(item) => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}
          onDelete={setVersionToDelete}
        />
      </StandardTablePage>

      <UploadVersionDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        form={uploadForm}
        products={products}
        selectedProductKey={productKey}
        selectedUploadFile={selectedUploadFile}
        uploadError={uploadError}
        uploading={uploading}
        uploadProgress={uploadProgress}
        activeJob={activeJob}
        selectedLogStepKey={selectedLogStepKey}
        terminalBadge={terminalBadge}
        terminalContent={terminalContent}
        terminalEmptyText={getTerminalEmptyText(activeJob)}
        onProductChange={(nextProductKey) => router.push(buildAdminHref(nextProductKey))}
        onFileChange={(file) => {
          setSelectedUploadFile(file);
          if (uploadError) {
            setUploadError(undefined);
          }
        }}
        onSelectStep={(stepKey) => {
          setSelectedLogStepKey(stepKey);
          setIsLogStepPinned(true);
        }}
        onSubmit={uploadVersion}
      />

      <BuildHistoryDrawer
        open={historyDrawerOpen}
        onOpenChange={(open) => {
          setHistoryDrawerOpen(open);
          if (!open) {
            setHistoryVersion(null);
            setHistoryJobId(undefined);
            setHistoryStepKey(null);
          }
        }}
        versionLabel={historyVersion?.version ?? null}
        jobs={versionHistoryJobs}
        activeJob={historyActiveJob}
        activeJobId={historyJobId}
        selectedLogStepKey={historyStepKey}
        terminalContent={historyActiveJob && historySelectedStep ? buildBuildJobStageText(historyActiveJob, historySelectedStep) : ''}
        onSelectJob={(job) => {
          setHistoryJobId(job.id);
          setHistoryStepKey(getBuildJobLogStep(job.currentStep));
        }}
        onSelectStep={(stepKey) => {
          setHistoryStepKey(stepKey);
        }}
      />

      <ConfirmDialog
        open={Boolean(versionToDelete)}
        onOpenChange={(open) => !open && setVersionToDelete(null)}
        title={versionToDelete ? `删除版本 ${versionToDelete.version}` : '删除版本'}
        description="删除后会同步移除已发布目录，请确认。"
        confirmLabel="删除"
        confirmVariant="destructive"
        pending={confirmingAction === 'version'}
        onConfirm={async () => {
          if (!versionToDelete) {
            return;
          }

          try {
            setConfirmingAction('version');
            await requestAction(`/api/versions/${versionToDelete.id}`, '版本已删除');
            setVersionToDelete(null);
          } catch (error) {
            toast.error(getErrorMessage(error, '版本删除失败'));
          } finally {
            setConfirmingAction(null);
          }
        }}
      />
    </>
  );
}
