import type { ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/layout/language-switcher';

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_26%,transparent),transparent_35%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--ring)_26%,transparent),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.6),transparent_88%)]" />

      <div className="absolute top-5 right-5 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
