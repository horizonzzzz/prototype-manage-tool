'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { BuildHistoryDrawer } from '@/components/admin/dialogs/build-history-drawer';
import { createUploadFormSchema, type UploadFormValues } from '@/components/admin/forms/form-schemas';
import { useActiveBuildJobLog, useHistoryBuildJobLog } from '@/components/admin/hooks/use-build-job-log';
import { useProductDetailState } from '@/components/admin/hooks/use-product-detail';
import { UploadVersionDialog } from '@/components/admin/dialogs/upload-version-dialog';
import { VersionManagementPanel } from '@/components/admin/panels/version-management-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import type { ApiResponse, BuildJobItem, BuildJobStepKey, ProductVersionItem } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import {
  getBuildJobTerminalSessionKey,
  getBuildJobLogStep,
  resolveBuildJobTerminalContent,
  shouldDisableBuildJobStepSelection,
  shouldUseBuildJobTerminalEmptyText,
} from '@/lib/ui/build-job-log';

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
  const t = useTranslations('admin.dashboard');
  const tValidation = useTranslations('admin.validation');
  const router = useRouter();
  const { activeJob, activeJobId, activateJob, jobs, loadError, loading, productDetail, productMissing, refreshCurrent } =
    useProductDetailState(productKey, t('errors.loadFailed'));
  const [selectedLogStepKey, setSelectedLogStepKey] = useState<BuildJobStepKey | null>(null);
  const [versionPage, setVersionPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [buildProgressDialogOpen, setBuildProgressDialogOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState<ProductVersionItem | null>(null);
  const [historyJobId, setHistoryJobId] = useState<number | null>(null);
  const [historyStepKey, setHistoryStepKey] = useState<BuildJobStepKey | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ProductVersionItem | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'version' | null>(null);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(createUploadFormSchema((key) => tValidation(key))),
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
    setHistoryJobId(null);
    setHistoryStepKey(null);
  }

  useEffect(() => {
    setVersionPage(1);
    setSelectedLogStepKey(null);
    setUploadDialogOpen(false);
    closeBuildLogDialog();
    resetUploadFormState();
  }, [productKey]);

  useEffect(() => {
    if (!activeJob) {
      setSelectedLogStepKey(null);
      return;
    }

    const currentStep = getBuildJobLogStep(activeJob.currentStep);
    if (shouldDisableBuildJobStepSelection(activeJob)) {
      setSelectedLogStepKey(currentStep);
      return;
    }

    if (!selectedLogStepKey || !activeJob.steps.some((step) => step.key === selectedLogStepKey)) {
      setSelectedLogStepKey(currentStep);
    }
  }, [activeJob, selectedLogStepKey]);

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
    if (!historyVersion || historyJobId === null) {
      return null;
    }

    return jobs.find((item) => item.id === historyJobId && item.version === historyVersion.version) ?? null;
  }, [historyJobId, historyVersion, jobs]);

  const historySelectedStep = useMemo(() => {
    if (!historyActiveJob) {
      return null;
    }

    return historyActiveJob.steps.find((step) => step.key === historyStepKey) ?? historyActiveJob.steps[0] ?? null;
  }, [historyActiveJob, historyStepKey]);

  useEffect(() => {
    if (!historyDrawerOpen || !historyActiveJob) {
      return;
    }

    const currentStep = getBuildJobLogStep(historyActiveJob.currentStep);
    if (shouldDisableBuildJobStepSelection(historyActiveJob)) {
      setHistoryStepKey(currentStep);
      return;
    }

    if (!historyStepKey || !historyActiveJob.steps.some((step) => step.key === historyStepKey)) {
      setHistoryStepKey(currentStep);
    }
  }, [historyActiveJob, historyDrawerOpen, historyStepKey]);

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
      setHistoryJobId(nextActive.id);
      setHistoryStepKey(getBuildJobLogStep(nextActive.currentStep));
      return;
    }

    setHistoryJobId(null);
    setHistoryStepKey(null);
  }

  const uploadVersion = uploadForm.handleSubmit(async (values) => {
    try {
      setUploadError(undefined);
      if (!productKey) {
        setUploadError(t('errors.selectProduct'));
        return;
      }
      if (!selectedUploadFile) {
        setUploadError(t('errors.selectFile'));
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
            reject(new Error(payload.message || t('errors.uploadFailed')));
            return;
          }

          toast.success(t('uploadStarted'));
          activateJob(payload.data);
          setSelectedLogStepKey(getBuildJobLogStep(payload.data.currentStep));
          setUploadDialogOpen(false);
          setBuildProgressDialogOpen(true);
          resetUploadFormState();
          void refreshCurrent().catch(() => toast.error(t('errors.refreshFailed')));
          resolve();
        };
        xhr.onerror = () => reject(new Error(t('errors.uploadFailed')));
        xhr.send(formData);
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('errors.uploadFailed');
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
  const buildLogSelectedStep = isActiveBuildLogDialog ? selectedStep : historySelectedStep;
  const buildLogTerminalContent = isActiveBuildLogDialog ? terminalContent : historyTerminalContent;
  const buildLogTerminalShowEmptyText = isActiveBuildLogDialog
    ? shouldUseBuildJobTerminalEmptyText(activeJob, selectedStep, activeJobLog)
    : shouldUseBuildJobTerminalEmptyText(historyActiveJob, historySelectedStep, historyJobLog);
  const buildLogStepSelectionInteractive = !shouldDisableBuildJobStepSelection(buildLogJob);
  const buildLogTerminalBadge = isActiveBuildLogDialog
    ? buildLogSelectedStep?.key ?? selectedLogStepKey ?? activeJob?.currentStep ?? 'status'
    : buildLogSelectedStep?.key ?? historyStepKey ?? historyActiveJob?.currentStep ?? 'status';

  if (productMissing && !loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold">{t('missingTitle')}</h2>
        <Button type="button" variant="link" onClick={() => router.push('/admin')}>
          {t('backToList')}
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
            <AlertTitle>{t('loadFailed')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{loadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void refreshCurrent().catch(() => toast.error(t('errors.refreshFailed')))}
              >
                {t('retry')}
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
          onOffline={(item) => void requestAction(`/api/versions/${item.id}/offline`, t('offlineSuccess'))}
          onPreviousPage={() => setVersionPage((current) => Math.max(1, current - 1))}
          onSetDefault={(item) => void requestAction(`/api/versions/${item.id}/default`, t('defaultUpdated'))}
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
        stepSelectionInteractive={buildLogStepSelectionInteractive}
        selectedLogStepKey={buildLogSelectedStepKey}
        terminalBadge={buildLogTerminalBadge}
        terminalContent={buildLogTerminalContent}
        terminalSessionKey={getBuildJobTerminalSessionKey(buildLogJob?.id, buildLogSelectedStepKey)}
        terminalShowEmptyText={buildLogTerminalShowEmptyText}
        onSelectStep={(stepKey) => {
          if (isActiveBuildLogDialog) {
            if (activeJob && shouldDisableBuildJobStepSelection(activeJob)) {
              return;
            }
            setSelectedLogStepKey(stepKey);
            return;
          }

          if (historyActiveJob && shouldDisableBuildJobStepSelection(historyActiveJob)) {
            return;
          }
          setHistoryStepKey(stepKey);
        }}
      />

      <ConfirmDialog
        open={Boolean(versionToDelete)}
        onOpenChange={(open) => !open && setVersionToDelete(null)}
        title={versionToDelete ? t('deleteVersionTitleWithName', { version: versionToDelete.version }) : t('deleteVersionTitle')}
        description={t('deleteVersionDescription')}
        confirmLabel={t('deleteConfirm')}
        confirmVariant="destructive"
        pending={confirmingAction === 'version'}
        onConfirm={async () => {
          if (!versionToDelete) {
            return;
          }

          try {
            setConfirmingAction('version');
            await requestAction(`/api/versions/${versionToDelete.id}`, t('deleteSuccess'));
            setVersionToDelete(null);
          } catch (error) {
            toast.error(t('errors.deleteFailed'));
          } finally {
            setConfirmingAction(null);
          }
        }}
      />
    </>
  );
}
