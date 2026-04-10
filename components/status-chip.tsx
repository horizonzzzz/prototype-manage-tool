import { cn } from '@/lib/utils';

const statusToneMap = {
  published: 'border-green-200 bg-green-50 text-green-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  building: 'border-blue-200 bg-blue-50 text-blue-700',
  queued: 'border-blue-200 bg-blue-50 text-blue-700',
  running: 'border-blue-200 bg-blue-50 text-blue-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  offline: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

type StatusChipProps = {
  status: keyof typeof statusToneMap | string;
  label?: string;
  className?: string;
  showDot?: boolean;
};

export function StatusChip({ status, label, className, showDot = true }: StatusChipProps) {
  const tone = statusToneMap[status as keyof typeof statusToneMap] ?? statusToneMap.offline;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase', tone, className)}>
      {showDot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {label ?? status}
    </span>
  );
}
