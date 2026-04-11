'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { BuildHistoryDrawer } from '@/components/admin/dialogs/build-history-drawer';
import { type UploadFormValues, uploadFormSchema } from '@/components/admin/forms/form-schemas';
import { useActiveBuildJobLog, useHistoryBuildJobLog } from '@/components/admin/hooks/use-build-job-log';
import { useProductDetailState } from '@/components/admin/hooks/use-product-detail';
import { UploadVersionDialog } from '@/components/admin/dialogs/upload-version-dialog';
import { VersionManagementPanel } from '@/components/admin/panels/version-management-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/domain/error-message';
import type { ApiResponse, BuildJobItem, BuildJobStepKey, ProductVersionItem } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import { getBuildJobLogStep, resolveBuildJobTerminalContent } from '@/lib/ui/build-job-log';

const ITEMS_PER_PAGE = 10;

function triggerVersionDownload(versionId: number): void {
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
  const { activeJob, activeJobId, activateJob, jobs, loadError, loading, productDetail, productMissing, refreshCurrent } =
    useProductDetailState(productKey);
  const [selectedLogStepKey, setSelectedLogStepKey] = useState<BuildJobStepKey | null>(null);
  const [isLogStepPinned, setIsLogStepPinned] = useState(false);
  const [versionPage, setVersionPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [buildProgressDialogOpen, setBuildProgressDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<ProductVersionItem | null>(null);
  const [historyStepKey, setHistoryStepKey] = useState<BuildJobStepKey | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'version' | null>(null);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { version: '', title: '', remark: '' },
  });

  function resetUploadFormState(): void {
    uploadForm.reset();
    setSelectedUploadFile(null);
    setUploadError(undefined);
    setUploading(false);
  }

  function closeBuildLogDialog(): void {
    setBuildProgressDialogOpen(false);
    setHistoryDrawerOpen(false);
    setHistoryVersion(null);
    setHistoryStepKey(null);
  }

  useEffect(() => {
    setVersionPage(1);
    setSelectedLogStepKey(null);
    setIsLogStepPinned(false);
    setUploadDialogOpen(false);
    closeBuildLogDialog();
    resetUploadFormState();
  }, [productKey]);

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

  const filteredVersions = useMemo(() => productDetail?.versions ?? [], [productDetail]);
  const totalVersionPages = Math.max(1, Math.ceil(filteredVersions.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setVersionPage((current) => Math.min(current, totalVersionPages));
  }, [totalVersionPages]);

  const currentVersionPage = Math.min(versionPage, totalVersionPages);
  const paginatedVersions = useMemo(() => {
    const startIndex = (currentVersionPage - 1) * ITEMS_PER_PAGE;
    return filteredVersions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
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

  const activeJobLog = useActiveBuildJobLog(activeJobId, activeJob, selectedLogStepKey);
  const historyJobLog = useHistoryBuildJobLog(historyDrawerOpen, historyActiveJob, historySelectedStep);

  async function requestAction(url: string, successText: string): Promise<void> {
    await fetchJson(url, { method: url.includes('/default') || url.includes('/offline') ? 'PATCH' : 'DELETE' });
    toast.success(successText);
    await refreshCurrent();
  }

  function openBuildHistory(item: ProductVersionItem): void {
    const scopedJobs = jobs.filter((job) => job.version === item.version);
    setHistoryVersion(item);
    setHistoryDrawerOpen(true);

    if (scopedJobs.length) {
      const nextActive = scopedJobs.find((job) => job.id === activeJobId) ?? scopedJobs[0];
      setHistoryStepKey(getBuildJobLogStep(nextActive.currentStep));
      return;
    }

    setHistoryStepKey(null);
  }

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
          activateJob(payload.data);
          setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
          setIsLogStepPinned(false);
          setUploadDialogOpen(false);
          setBuildProgressDialogOpen(true);
          resetUploadFormState();
          void refreshCurrent().catch((error) => toast.error(getErrorMessage(error, '刷新产品详情失败')));
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

        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{loadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void refreshCurrent().catch((error) => toast.error(getErrorMessage(error, '刷新产品详情失败')))}
              >
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <VersionManagementPanel
          currentPage={currentVersionPage}
          loading={loading}
          showLoadingState={loading && !productDetail}
          totalPages={totalVersionPages}
          totalVersions={filteredVersions.length}
          versions={paginatedVersions}
          onDelete={setVersionToDelete}
          onDownload={(item) => triggerVersionDownload(item.id)}
          onHistory={openBuildHistory}
          onNextPage={() => setVersionPage((current) => Math.min(totalVersionPages, current + 1))}
          onOffline={(item) => void requestAction(`/api/versions/${item.id}/offline`, '版本已下线')}
          onPreviousPage={() => setVersionPage((current) => Math.max(1, current - 1))}
          onSetDefault={(item) => void requestAction(`/api/versions/${item.id}/default`, '默认版本已更新')}
          onUploadVersion={() => setUploadDialogOpen(true)}
        />
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
            closeBuildLogDialog();
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
