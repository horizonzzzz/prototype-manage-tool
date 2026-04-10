'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleDashed, Download, History, Package2, Power, Star, Trash2, Upload } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { BuildHistoryDrawer } from '@/components/admin/build-history-drawer';
import { UploadVersionDialog } from '@/components/admin/upload-version-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusChip } from '@/components/status-chip';
import { StandardTablePage } from '@/components/standard-table-page';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { formatDateTime } from '@/lib/ui/format';
import { getVersionStatusLabel, isVersionActionEnabled, selectActiveBuildJob } from '@/lib/ui/product-detail-view';
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
  const [search, setSearch] = useState('');
  const [versionPage, setVersionPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<ProductVersionItem | null>(null);
  const [historyStepKey, setHistoryStepKey] = useState<BuildJobStepKey | null>(null);
  const [historyJobLog, setHistoryJobLog] = useState<BuildJobLogItem | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'version' | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const uploadDialogOpenRef = useRef(uploadDialogOpen);
  const uploadDialogSessionRef = useRef(0);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { version: '', title: '', remark: '' },
  });

  useEffect(() => {
    uploadDialogOpenRef.current = uploadDialogOpen;
  }, [uploadDialogOpen]);

  const resetUploadDialogState = () => {
    uploadDialogSessionRef.current += 1;
    uploadForm.reset();
    setSelectedUploadFile(null);
    setUploadError(undefined);
    setUploading(false);
    setUploadProgress(0);
    setActiveJobId(undefined);
    setActiveJob(null);
    setActiveJobLog(null);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
  };

  const clearProductContext = () => {
    setProductDetail(null);
    setJobs([]);
    setVersionPage(1);
    setActiveJobId(undefined);
    setActiveJob(null);
    setActiveJobLog(null);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
    setHistoryDrawerOpen(false);
    setHistoryVersion(null);
    setHistoryStepKey(null);
    setHistoryJobLog(null);
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
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    setVersionPage(1);
  }, [deferredSearch, productKey]);

  const totalVersionPages = Math.max(1, Math.ceil(filteredVersions.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setVersionPage((current) => Math.min(current, totalVersionPages));
  }, [totalVersionPages]);

  const currentVersionPage = Math.min(versionPage, totalVersionPages);
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
    const dialogSessionId = uploadDialogSessionRef.current;

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
          if (event.lengthComputable && uploadDialogOpenRef.current && uploadDialogSessionRef.current === dialogSessionId) {
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
          await loadProductDetail(productKey);
          if (uploadDialogOpenRef.current && uploadDialogSessionRef.current === dialogSessionId) {
            uploadForm.reset();
            setSelectedUploadFile(null);
            setActiveJobId(payload.data.id);
            setActiveJob(payload.data);
            setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
            setIsLogStepPinned(false);
          }
          resolve();
        };
        xhr.onerror = () => reject(new Error('上传失败'));
        xhr.send(formData);
      });
    } catch (error) {
      const message = getErrorMessage(error, '上传失败');
      if (uploadDialogOpenRef.current && uploadDialogSessionRef.current === dialogSessionId) {
        setUploadError(message);
      }
      toast.error(message);
    } finally {
      if (uploadDialogSessionRef.current === dialogSessionId) {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  });

  const selectedStep = activeJob?.steps.find((step) => step.key === selectedLogStepKey) ?? null;
  const terminalContent = resolveBuildJobTerminalContent(activeJob, selectedStep, activeJobLog);
  const terminalBadge = activeJobLog?.step ?? selectedLogStepKey ?? activeJob?.currentStep ?? 'status';
  const historyTerminalContent = resolveBuildJobTerminalContent(historyActiveJob, historySelectedStep, historyJobLog);
  const activeJobProgress =
    activeJob && ['queued', 'running'].includes(activeJob.status) && Number.isFinite(activeJob.progressPercent)
      ? Math.max(0, Math.min(100, activeJob.progressPercent))
      : null;

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
        <div className="space-y-4 border-b border-[color:var(--border)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-slate-50 px-3 py-1.5 text-slate-600">
              <Package2 className="size-3.5 shrink-0" />
              <span className="max-w-[min(64vw,420px)] truncate font-mono text-[12px]" title={productDetail?.key ?? productKey}>
                {productDetail?.key ?? productKey}
              </span>
            </div>
            <div className="text-slate-500">
              创建时间：{productDetail ? formatDateTime(productDetail.createdAt) : '—'}
            </div>
            <div className="text-slate-500">
              已发布版本：<span className="font-semibold text-slate-900">{productDetail?.publishedCount ?? 0}</span>
            </div>
            {productDetail?.description ? (
              <div className="max-w-[min(72vw,640px)] truncate text-slate-500" title={productDetail.description}>
                {productDetail.description}
              </div>
            ) : null}
          </div>

          {activeJob ? (
            <div
              className={`rounded-[14px] border px-4 py-3 ${
                ['queued', 'running'].includes(activeJob.status)
                  ? 'border-sky-200 bg-sky-50/80 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.1)]'
                  : 'border-[color:var(--border)] bg-slate-50/70'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusChip
                    status={activeJob.status === 'queued' ? 'running' : activeJob.status}
                    label={getVersionStatusLabel(activeJob.status)}
                    className={['queued', 'running'].includes(activeJob.status) ? 'ring-1 ring-sky-300/60' : undefined}
                  />
                  {['queued', 'running'].includes(activeJob.status) ? (
                    <CircleDashed className="size-4 animate-spin text-sky-500" />
                  ) : null}
                  <span className="text-xs text-slate-500">当前任务版本</span>
                  <span className="max-w-[min(40vw,320px)] truncate font-mono text-sm text-slate-800" title={activeJob.version}>
                    {activeJob.version}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{formatDateTime(activeJob.createdAt)}</span>
              </div>
              {activeJobProgress !== null ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>构建进度</span>
                    <span className="font-semibold text-slate-900">{activeJobProgress}%</span>
                  </div>
                  <Progress value={activeJobProgress} className="h-2.5" />
                </div>
              ) : null}
              {activeJob.logSummary ? (
                <p className="mt-2 truncate text-xs text-slate-600" title={activeJob.logSummary}>
                  {activeJob.logSummary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="overflow-hidden rounded-[16px] border border-[color:var(--border)]">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%] px-3">版本号</TableHead>
                  <TableHead className="w-[16%] px-3">状态</TableHead>
                  <TableHead className="px-3">标题 / 备注</TableHead>
                  <TableHead className="w-[14%] px-3">创建时间</TableHead>
                  <TableHead className="w-[36%] px-3">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVersions.length ? (
                  paginatedVersions.map((item) => {
                    const setDefaultEnabled = isVersionActionEnabled('setDefault', {
                      status: item.status,
                      isDefault: item.isDefault,
                    });
                    const offlineEnabled = isVersionActionEnabled('offline', {
                      status: item.status,
                      isDefault: item.isDefault,
                    });

                    return (
                      <TableRow key={item.id} className={['queued', 'running'].includes(item.status) ? 'bg-sky-50/60' : undefined}>
                        <TableCell className="px-3 py-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="max-w-[220px] truncate font-mono text-[13px] font-semibold text-slate-900" title={item.version}>
                              {item.version}
                            </span>
                            {item.isDefault ? <StatusChip status="offline" label="默认版本" showDot={false} /> : null}
                            {item.isLatest ? <StatusChip status="running" label="最新记录" showDot={false} /> : null}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip
                              status={item.status === 'queued' ? 'running' : item.status}
                              label={getVersionStatusLabel(item.status)}
                              className={['queued', 'running'].includes(item.status) ? 'ring-1 ring-sky-300/70' : undefined}
                            />
                            {['queued', 'running'].includes(item.status) ? (
                              <CircleDashed className="size-3.5 animate-spin text-sky-500" />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-4">
                          <div className="truncate text-slate-800" title={item.title ?? undefined}>
                            {item.title || '—'}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-500" title={item.remark ?? undefined}>
                            {item.remark || '无备注'}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-4 text-[11px] leading-4 text-slate-500">{formatDateTime(item.createdAt)}</TableCell>
                        <TableCell className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={() => openBuildHistory(item)}>
                              <History />
                              历史
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!item.downloadable}
                              onClick={() => triggerVersionDownload(item.id)}
                            >
                              <Download />
                              下载
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!setDefaultEnabled}
                              onClick={() => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}
                            >
                              <Star />
                              设默认
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!offlineEnabled}
                              onClick={() => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}
                            >
                              <Power />
                              下线
                            </Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => setVersionToDelete(item)}>
                              <Trash2 />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-slate-500">
                      暂无匹配版本记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              共 {filteredVersions.length} 条，当前第 {currentVersionPage} / {totalVersionPages} 页
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVersionPage((current) => Math.max(1, current - 1))}
                disabled={currentVersionPage === 1}
              >
                <ChevronLeft />
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVersionPage((current) => Math.min(totalVersionPages, current + 1))}
                disabled={currentVersionPage >= totalVersionPages}
              >
                下一页
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </StandardTablePage>

      <UploadVersionDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            resetUploadDialogState();
          }
        }}
        form={uploadForm}
        productName={productDetail?.name}
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
            setHistoryStepKey(null);
            setHistoryJobLog(null);
          }
        }}
        versionLabel={historyVersion?.version ?? null}
        activeJob={historyActiveJob}
        selectedLogStepKey={historyStepKey}
        terminalContent={historyTerminalContent}
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
