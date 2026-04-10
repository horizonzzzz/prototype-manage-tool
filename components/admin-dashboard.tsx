'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { BuildHistoryDrawer } from '@/components/admin/build-history-drawer';
import { UploadVersionDialog } from '@/components/admin/upload-version-dialog';
import { VersionListContent } from '@/components/admin/version-list-content';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
  ProductVersionItem,
} from '@/lib/types';
import { selectActiveBuildJob } from '@/lib/ui/product-detail-view';
import {
  applyBuildJobLogStreamEvent,
  buildBuildJobLogStreamUrl,
  getBuildJobLogStep,
  isBuildJobLogStreamStep,
  resolveBuildJobTerminalContent,
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

const ITEMS_PER_PAGE = 10;

export function AdminDashboard({ productKey }: { productKey: string }) {
  const router = useRouter();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [activeJobLog, setActiveJobLog] = useState<BuildJobLogItem | null>(null);
  const [selectedLogStepKey, setSelectedLogStepKey] = useState<BuildJobStepKey | null>(null);
  const [isLogStepPinned, setIsLogStepPinned] = useState(false);
  const [versionPage, setVersionPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [buildProgressDialogOpen, setBuildProgressDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<ProductVersionItem | null>(null);
  const [historyStepKey, setHistoryStepKey] = useState<BuildJobStepKey | null>(null);
  const [historyJobLog, setHistoryJobLog] = useState<BuildJobLogItem | null>(null);
  const [productMissing, setProductMissing] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'version' | null>(null);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { version: '', title: '', remark: '' },
  });

  const resetUploadFormState = () => {
    uploadForm.reset();
    setSelectedUploadFile(null);
    setUploadError(undefined);
    setUploading(false);
  };

  const clearProductContext = () => {
    setProductDetail(null);
    setJobs([]);
    setVersionPage(1);
    setUploadDialogOpen(false);
    setBuildProgressDialogOpen(false);
    setActiveJobId(undefined);
    setActiveJob(null);
    setActiveJobLog(null);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
    setHistoryDrawerOpen(false);
    setHistoryVersion(null);
    setHistoryStepKey(null);
    setHistoryJobLog(null);
    setProductMissing(false);
  };

  const syncJobs = (nextJobs: BuildJobItem[]) => {
    setJobs(nextJobs);
    const nextActive = selectActiveBuildJob(nextJobs, activeJobId);

    setActiveJobId(nextActive?.id);
    setActiveJob(nextActive ?? null);
  };

  const loadProductDetail = async (targetProductKey: string) => {
    setLoading(true);
    try {
      const [detail, buildJobs] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${targetProductKey}`),
        fetchJson<BuildJobItem[]>(`/api/products/${targetProductKey}/build-jobs`),
      ]);
      setProductDetail(detail);
      syncJobs(buildJobs);
      setProductMissing(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!productKey) {
      clearProductContext();
      return;
    }

    void loadProductDetail(productKey).catch((error) => {
      const message = getErrorMessage(error, '加载产品详情失败');
      setProductDetail(null);
      syncJobs([]);
      setProductMissing(true);
      if (message !== 'Product not found') {
        toast.error(message);
      }
    });
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

  const filteredVersions = useMemo(() => productDetail?.versions ?? [], [productDetail]);

  useEffect(() => {
    setVersionPage(1);
  }, [productKey]);

  const totalVersionPages = Math.ceil(filteredVersions.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setVersionPage((current) => (totalVersionPages > 0 ? Math.min(current, totalVersionPages) : 1));
  }, [totalVersionPages]);

  const currentVersionPage = totalVersionPages > 0 ? Math.min(versionPage, totalVersionPages) : 1;
  const paginatedVersions = useMemo(() => {
    const startIndex = (currentVersionPage - 1) * ITEMS_PER_PAGE;
    const paginatedVersions = filteredVersions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    return paginatedVersions;
  }, [currentVersionPage, filteredVersions]);

  const historyActiveJob = useMemo(() => {
    if (!historyVersion) {
      return null;
    }

    const scopedJobs = jobs.filter((item) => item.version === historyVersion.version);
    if (!scopedJobs.length) {
      return null;
    }

    return scopedJobs.find((item) => item.id === activeJobId) ?? scopedJobs[0];
  }, [activeJobId, historyVersion, jobs]);

  const historySelectedStep = useMemo(() => {
    if (!historyActiveJob) {
      return null;
    }

    return historyActiveJob.steps.find((step) => step.key === historyStepKey) ?? historyActiveJob.steps[0] ?? null;
  }, [historyActiveJob, historyStepKey]);

  useEffect(() => {
    if (!historyDrawerOpen || !historyActiveJob || !historySelectedStep) {
      setHistoryJobLog(null);
      return;
    }

    const logStep = getBuildJobLogStep(historySelectedStep.key);
    if (!logStep) {
      setHistoryJobLog(null);
      return;
    }

    let cancelled = false;
    setHistoryJobLog(null);

    const loadHistoryLog = async () => {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${historyActiveJob.id}/logs?step=${logStep}`);
        if (!cancelled) {
          setHistoryJobLog(payload);
        }
      } catch {
        if (!cancelled) {
          setHistoryJobLog({ step: logStep, content: '', exists: false, updatedAt: null });
        }
      }
    };

    void loadHistoryLog();

    return () => {
      cancelled = true;
    };
  }, [historyActiveJob, historyDrawerOpen, historySelectedStep]);

  const refreshCurrent = async () => {
    if (!productKey) {
      return;
    }

    await loadProductDetail(productKey);
  };

  const requestAction = async (url: string, successText: string) => {
    await fetchJson(url, { method: url.includes('/default') || url.includes('/offline') ? 'PATCH' : 'DELETE' });
    toast.success(successText);
    await refreshCurrent();
  };

  const openBuildHistory = (item: ProductVersionItem) => {
    const scopedJobs = jobs.filter((job) => job.version === item.version);
    setHistoryVersion(item);
    setHistoryDrawerOpen(true);
    if (scopedJobs.length) {
      const nextActive = scopedJobs.find((job) => job.id === activeJobId) ?? scopedJobs[0];
      setHistoryStepKey(getBuildJobLogStep(nextActive.currentStep));
      return;
    }

    setHistoryStepKey(null);
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
        xhr.onload = async () => {
          const payload = JSON.parse(xhr.responseText) as ApiResponse<BuildJobItem>;
          if (xhr.status >= 400 || !payload.success || !payload.data) {
            reject(new Error(payload.message || '上传失败'));
            return;
          }

          toast.success('源码包上传成功，后台任务已开始');
          setActiveJobId(payload.data.id);
          setActiveJob(payload.data);
          setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
          setIsLogStepPinned(false);
          setUploadDialogOpen(false);
          setBuildProgressDialogOpen(true);
          resetUploadFormState();
          void loadProductDetail(productKey).catch((error) => toast.error(getErrorMessage(error, '刷新产品详情失败')));
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
    }
  });

  const selectedStep = activeJob?.steps.find((step) => step.key === selectedLogStepKey) ?? null;
  const terminalContent = resolveBuildJobTerminalContent(activeJob, selectedStep, activeJobLog);
  const historyTerminalContent = resolveBuildJobTerminalContent(historyActiveJob, historySelectedStep, historyJobLog);
  const buildLogDialogOpen = buildProgressDialogOpen || historyDrawerOpen;
  const isActiveBuildLogDialog = buildProgressDialogOpen;
  const buildLogJob = isActiveBuildLogDialog ? activeJob : historyActiveJob;
  const buildLogVersionLabel = isActiveBuildLogDialog ? activeJob?.version ?? null : historyVersion?.version ?? null;
  const buildLogSelectedStepKey = isActiveBuildLogDialog ? selectedLogStepKey : historyStepKey;
  const buildLogTerminalContent = isActiveBuildLogDialog ? terminalContent : historyTerminalContent;
  const buildLogTerminalBadge = isActiveBuildLogDialog
    ? activeJobLog?.step ?? selectedLogStepKey ?? activeJob?.currentStep ?? 'status'
    : historyJobLog?.step ?? historyStepKey ?? historyActiveJob?.currentStep ?? 'status';

  if (productMissing && !loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold">产品不存在</h2>
        <Button type="button" variant="link" onClick={() => router.push('/admin')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{productDetail?.name ?? productKey}</h2>
            <p className="text-muted-foreground">Key: {productDetail?.key ?? productKey}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col space-y-1.5">
              <h3 className="font-semibold leading-none tracking-tight">版本列表</h3>
              <p className="text-sm text-muted-foreground">管理该产品的所有原型版本</p>
            </div>
            <Button type="button" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              上传新版本
            </Button>
          </div>
          <div className="p-6 pt-0">
            {loading && !productDetail ? (
              <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-[color:var(--border)] bg-slate-50/80 px-4 text-sm text-slate-500">
                正在加载版本列表...
              </div>
            ) : (
              <VersionListContent
                versions={paginatedVersions}
                onHistory={openBuildHistory}
                onDownload={(item) => triggerVersionDownload(item.id)}
                onSetDefault={(item) => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}
                onOffline={(item) => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}
                onDelete={setVersionToDelete}
              />
            )}

            {filteredVersions.length ? (
              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">共 {filteredVersions.length} 个版本</div>
                <div className="space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVersionPage((current) => Math.max(1, current - 1))}
                    disabled={currentVersionPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <div className="inline-flex items-center justify-center px-2 text-sm font-medium">
                    {currentVersionPage} / {totalVersionPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVersionPage((current) => Math.min(totalVersionPages, current + 1))}
                    disabled={currentVersionPage >= totalVersionPages}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <UploadVersionDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open && uploading) {
            return;
          }
          setUploadDialogOpen(open);
          if (!open) {
            resetUploadFormState();
          }
        }}
        form={uploadForm}
        productName={productDetail?.name}
        selectedProductKey={productKey}
        selectedUploadFile={selectedUploadFile}
        uploadError={uploadError}
        uploading={uploading}
        onCancel={() => {
          if (!uploading) {
            setUploadDialogOpen(false);
            resetUploadFormState();
          }
        }}
        onFileChange={(file) => {
          setSelectedUploadFile(file);
          if (uploadError) {
            setUploadError(undefined);
          }
        }}
        onSubmit={uploadVersion}
      />

      <BuildHistoryDrawer
        open={buildLogDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBuildProgressDialogOpen(false);
            setHistoryDrawerOpen(false);
            setHistoryVersion(null);
            setHistoryStepKey(null);
            setHistoryJobLog(null);
          }
        }}
        versionLabel={buildLogVersionLabel}
        activeJob={buildLogJob}
        selectedLogStepKey={buildLogSelectedStepKey}
        terminalBadge={buildLogTerminalBadge}
        terminalContent={buildLogTerminalContent}
        onSelectStep={(stepKey) => {
          if (isActiveBuildLogDialog) {
            setSelectedLogStepKey(stepKey);
            setIsLogStepPinned(true);
            return;
          }

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
