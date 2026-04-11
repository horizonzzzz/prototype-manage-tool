'use client';

import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { VersionListContent } from '@/components/admin/panels/version-list-content';
import { Button } from '@/components/ui/button';
import type { ProductVersionItem } from '@/lib/types';

type VersionManagementPanelProps = {
  currentPage: number;
  loading: boolean;
  showLoadingState: boolean;
  totalPages: number;
  totalVersions: number;
  versions: ProductVersionItem[];
  onDelete: (item: ProductVersionItem) => void;
  onDownload: (item: ProductVersionItem) => void;
  onHistory: (item: ProductVersionItem) => void;
  onNextPage: () => void;
  onOffline: (item: ProductVersionItem) => void;
  onPreviousPage: () => void;
  onSetDefault: (item: ProductVersionItem) => void;
  onUploadVersion: () => void;
};

export function VersionManagementPanel({
  currentPage,
  loading,
  showLoadingState,
  totalPages,
  totalVersions,
  versions,
  onDelete,
  onDownload,
  onHistory,
  onNextPage,
  onOffline,
  onPreviousPage,
  onSetDefault,
  onUploadVersion,
}: VersionManagementPanelProps) {
  const t = useTranslations('admin.versionManagement');

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col space-y-1.5">
          <h3 className="font-semibold leading-none tracking-tight">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button type="button" onClick={onUploadVersion}>
          <Upload className="mr-2 h-4 w-4" />
          {t('upload')}
        </Button>
      </div>
      <div className="p-6 pt-0">
        {showLoadingState ? (
          <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-[color:var(--border)] bg-slate-50/80 px-4 text-sm text-slate-500">
            {t('loading')}
          </div>
        ) : (
          <VersionListContent
            versions={versions}
            onHistory={onHistory}
            onDownload={onDownload}
            onSetDefault={onSetDefault}
            onOffline={onOffline}
            onDelete={onDelete}
          />
        )}

        {totalVersions ? (
          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">{t('total', { count: totalVersions })}</div>
            <div className="space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={onPreviousPage} disabled={currentPage === 1 || loading}>
                <ChevronLeft className="h-4 w-4" />
                {t('previous')}
              </Button>
              <div className="inline-flex items-center justify-center px-2 text-sm font-medium">
                {currentPage} / {totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNextPage}
                disabled={currentPage >= totalPages || loading}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
