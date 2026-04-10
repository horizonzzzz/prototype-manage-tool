import type { ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/layout/language-switcher';

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
