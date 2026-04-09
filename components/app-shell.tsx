'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers3, PanelsTopLeft } from 'lucide-react';

import { appNavigationItems } from '@/lib/ui/navigation';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-900">
      <aside className="flex h-screen w-[248px] shrink-0 flex-col border-r border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/86 px-4 py-5 backdrop-blur-xl">
        <Link
          href="/preview"
          className="rounded-[20px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] px-4 py-4 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary-soft),rgba(255,255,255,0.96))] text-[color:var(--primary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <PanelsTopLeft className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">Prototype Manage Tool</div>
              <div className="mt-1 text-xs text-slate-500">统一预览与发布管理</div>
            </div>
          </div>
        </Link>

        <nav className="mt-8 space-y-2" aria-label="Primary navigation">
          {appNavigationItems.map((item) => {
            const isActive = item.match(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group block rounded-[18px] border px-4 py-3 transition-all',
                  isActive
                    ? 'border-sky-200 bg-sky-50/90 shadow-[var(--shadow-soft)]'
                    : 'border-transparent bg-transparent hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white/82',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={cn('text-sm font-semibold', isActive ? 'text-slate-950' : 'text-slate-700')}>
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                  </div>
                  <Layers3 className={cn('size-4 transition-colors', isActive ? 'text-sky-500' : 'text-slate-300 group-hover:text-slate-400')} />
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-[76px] shrink-0 items-center border-b border-[color:color-mix(in_srgb,var(--border-strong)_72%,transparent)] bg-white/78 px-8 backdrop-blur-xl">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">Workspace</div>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">产品预览与发布工作台</h1>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
