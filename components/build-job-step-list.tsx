'use client';

import React from 'react';

import type { BuildJobStepItem, BuildJobStepKey } from '@/lib/types';
import { cn } from '@/lib/utils';

type BuildJobStepListProps = {
  interactive?: boolean;
  steps: BuildJobStepItem[];
  selectedStepKey: BuildJobStepKey | null;
  onSelect: (stepKey: BuildJobStepKey) => void;
};

function getStatusClasses(status: string, selected: boolean) {
  if (status === 'success') {
    return {
      shell: cn(selected ? 'opacity-100' : 'opacity-90', 'border-emerald-200/60 bg-emerald-50/60'),
      dot: 'border-emerald-200 bg-[radial-gradient(circle_at_center,#10b981_38%,rgba(16,185,129,0.18)_40%)]',
      title: 'text-slate-900',
    };
  }

  if (status === 'running') {
    return {
      shell: cn(selected ? 'opacity-100 ring-2 ring-sky-100' : 'opacity-100', 'border-sky-200/70 bg-sky-50/70'),
      dot: 'border-sky-200 bg-[radial-gradient(circle_at_center,#3b82f6_36%,rgba(59,130,246,0.18)_38%),linear-gradient(90deg,rgba(37,99,235,0.2),rgba(96,165,250,0.1))]',
      title: 'text-blue-700',
    };
  }

  if (status === 'failed') {
    return {
      shell: cn(selected ? 'opacity-100' : 'opacity-90', 'border-rose-200/70 bg-rose-50/60'),
      dot: 'border-rose-200 bg-[radial-gradient(circle_at_center,#ef4444_38%,rgba(239,68,68,0.18)_40%)]',
      title: 'text-slate-900',
    };
  }

  return {
    shell: cn(selected ? 'opacity-100 ring-2 ring-sky-100/80' : 'opacity-65', 'border-transparent bg-transparent'),
    dot: 'border-slate-300 bg-transparent',
    title: selected ? 'text-blue-700' : 'text-slate-900',
  };
}

export function BuildJobStepList({ steps, selectedStepKey, onSelect, interactive = true }: BuildJobStepListProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {steps.map((step) => (
        <button
          key={step.key}
          type="button"
          disabled={!interactive}
          data-status={step.status}
          aria-pressed={step.key === selectedStepKey}
          aria-disabled={!interactive}
          className={cn(
            'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-transform',
            interactive ? 'hover:-translate-y-0.5' : 'cursor-default',
            getStatusClasses(step.status, step.key === selectedStepKey).shell,
          )}
          onClick={() => onSelect(step.key)}
        >
          <div className={cn('mt-0.5 size-[18px] rounded-full border-2', getStatusClasses(step.status, step.key === selectedStepKey).dot)} />
          <div className="min-w-0">
            <p className={cn('m-0 text-sm font-semibold', getStatusClasses(step.status, step.key === selectedStepKey).title)}>{step.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
