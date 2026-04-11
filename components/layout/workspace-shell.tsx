'use client';

import type { ReactNode } from 'react';
import { Layers3, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserNav } from '@/components/layout/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { appNavigationItems } from '@/lib/ui/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface WorkspaceShellProps {
  children: ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const t = useTranslations('workspaceShell');
  const pathname = usePathname();

  const renderNav = () => (
    <>
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Layers3 className="size-4" />
          </div>
          <span className="text-lg tracking-tight">Admin Pro</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-4 text-sm font-medium">
          {appNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);
            const resolvedNavigationLabel = t(`nav.${item.href.slice(1)}`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:text-primary',
                  isActive ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="size-4" />
                {resolvedNavigationLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">{renderNav()}</aside>
      <div className="flex w-full flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('toggleMenu')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 sm:max-w-xs">
              <div className="flex h-full flex-col bg-card">{renderNav()}</div>
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="ml-auto flex-1 sm:flex-initial" />
            <ThemeToggle />
            <UserNav />
          </div>
        </header>

        <main className="flex-1 items-start p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </div>
    </div>
  );
}
