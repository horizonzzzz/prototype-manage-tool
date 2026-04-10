'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers3 } from 'lucide-react';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserNav } from '@/components/layout/user-nav';
import { appNavigationItems } from '@/lib/ui/navigation';
import { cn } from '@/lib/utils';

interface WorkspaceShellProps {
  children: ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const activeNavItem = appNavigationItems.find((item) => item.match(pathname)) ?? appNavigationItems[0];

  return (
    <div className="flex h-screen overflow-hidden text-[color:var(--foreground)]">
      <aside className="hidden h-screen w-64 shrink-0 border-r border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_86%,transparent)] p-4 backdrop-blur-xl md:flex md:flex-col">
        <Link
          href="/admin"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-soft)] p-4 shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]">
              <Layers3 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">Prototype Manage Tool</p>
              <p className="text-xs text-[color:var(--muted-foreground)]">Workspace Console</p>
            </div>
          </div>
        </Link>

        <nav className="mt-6 space-y-2" aria-label="Workspace navigation">
          {appNavigationItems.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-xl border px-3 py-3 transition',
                  isActive
                    ? 'border-[color:var(--ring)] bg-[color:var(--primary-soft)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)]'
                    : 'border-transparent text-[color:var(--secondary-foreground)] hover:border-[color:var(--border)] hover:bg-[color:var(--panel-soft)]',
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('size-4', isActive ? 'text-[color:var(--primary-strong)]' : 'text-[color:var(--muted-foreground)]')} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="truncate text-xs text-[color:var(--muted-foreground)]">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--card)_78%,transparent)] px-4 backdrop-blur-xl md:px-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[color:var(--muted-foreground)] uppercase">Workspace</p>
            <h1 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">{activeNavItem?.label ?? 'Workspace'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <UserNav />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6">{children}</main>
      </div>
    </div>
  );
}
