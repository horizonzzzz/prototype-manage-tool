'use client';

import { MonitorPlay } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type PreviewEmptyStateProps = {
  onGoToAdmin: () => void;
};

export function PreviewEmptyState({ onGoToAdmin }: PreviewEmptyStateProps) {
  const t = useTranslations('preview.empty');

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 px-6 text-center">
      <MonitorPlay className="mb-4 h-12 w-12 text-slate-300" />
      <h3 className="text-lg font-medium text-slate-900">{t('title')}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{t('description')}</p>
      <Button type="button" variant="outline" className="mt-5" onClick={onGoToAdmin}>
        {t('action')}
      </Button>
    </div>
  );
}
