'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { AuthShell } from '@/components/layout/auth-shell';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { isAuthRoute, isWorkspaceRoute } from '@/lib/ui/app-preferences';

interface AppFrameProps {
  children: ReactNode;
}

export function AppFrame({ children }: AppFrameProps) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return <AuthShell>{children}</AuthShell>;
  }

  if (isWorkspaceRoute(pathname)) {
    return <WorkspaceShell>{children}</WorkspaceShell>;
  }

  return <>{children}</>;
}
