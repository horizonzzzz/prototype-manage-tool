import { cn } from '@/lib/utils';

const statusToneMap = {
  published: 'border-[color:color-mix(in_srgb,var(--success)_14%,transparent)] bg-[var(--success-soft)] text-[var(--success)]',
  success: 'border-[color:color-mix(in_srgb,var(--success)_14%,transparent)] bg-[var(--success-soft)] text-[var(--success)]',
  building: 'border-[color:color-mix(in_srgb,var(--primary)_14%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]',
  queued: 'border-[color:color-mix(in_srgb,var(--primary)_14%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]',
  running: 'border-[color:color-mix(in_srgb,var(--primary)_14%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]',
  failed: 'border-[color:color-mix(in_srgb,var(--destructive)_14%,transparent)] bg-[var(--destructive-soft)] text-[var(--destructive)]',
  offline: 'border-[color:color-mix(in_srgb,var(--muted-foreground)_14%,transparent)] bg-slate-100/90 text-[var(--muted-foreground)]',
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
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase',
        tone,
        className,
      )}
    >
      {showDot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {label ?? status}
    </span>
  );
}
