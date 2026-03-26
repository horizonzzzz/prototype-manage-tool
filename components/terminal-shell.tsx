import type { ReactNode } from 'react';

type TerminalShellProps = {
  badge: string;
  children: ReactNode;
};

export function TerminalShell({ badge, children }: TerminalShellProps) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-slate-900/8 bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-slate-500/70" />
          <span className="size-2.5 rounded-full bg-slate-500/70" />
          <span className="size-2.5 rounded-full bg-slate-500/70" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 font-mono text-[11px] text-sky-100">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(34,197,94,0.16)]" />
          {badge}
        </div>
      </div>
      <div className="min-h-[280px] p-3">{children}</div>
    </div>
  );
}
