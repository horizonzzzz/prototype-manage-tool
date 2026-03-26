import { StatusChip } from '@/components/status-chip';
import type { BuildJobItem } from '@/lib/types';

type RecentJobsContentProps = {
  jobs: BuildJobItem[];
  activeJobId?: number;
  onSelect: (job: BuildJobItem) => void;
};

export function RecentJobsContent({ jobs, activeJobId, onSelect }: RecentJobsContentProps) {
  if (!jobs.length) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-4 text-sm text-slate-500">
        暂无任务记录
      </div>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {jobs.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`w-full rounded-[12px] border px-4 py-4 text-left transition ${
            item.id === activeJobId
              ? 'border-sky-200 bg-slate-50/92 shadow-[var(--shadow-soft)]'
              : 'border-transparent hover:-translate-y-0.5 hover:border-sky-100 hover:bg-slate-50/82'
          }`}
          onClick={() => onSelect(item)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[13px] font-semibold text-slate-800">{item.version}</span>
              <StatusChip status={item.status} />
            </div>
            <span className="text-xs text-slate-500">{item.progressPercent}%</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-sm text-slate-700">{item.fileName}</div>
            <div className="text-sm text-slate-500">{item.errorMessage || item.logSummary || '等待执行'}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
