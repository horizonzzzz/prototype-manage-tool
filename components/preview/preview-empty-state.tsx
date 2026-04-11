'use client';

import { MonitorPlay } from 'lucide-react';

import { Button } from '@/components/ui/button';

type PreviewEmptyStateProps = {
  onGoToAdmin: () => void;
};

export function PreviewEmptyState({ onGoToAdmin }: PreviewEmptyStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 px-6 text-center">
      <MonitorPlay className="mb-4 h-12 w-12 text-slate-300" />
      <h3 className="text-lg font-medium text-slate-900">暂无产品</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">请先在发布管理台中创建产品并发布版本。</p>
      <Button type="button" variant="outline" className="mt-5" onClick={onGoToAdmin}>
        前往发布管理
      </Button>
    </div>
  );
}
