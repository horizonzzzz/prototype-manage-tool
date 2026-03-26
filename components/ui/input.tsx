import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full rounded-xl border border-[color:var(--border-strong)] bg-white/92 px-3 py-2 text-sm text-slate-900 shadow-[var(--shadow-soft)] outline-none transition placeholder:text-slate-400 focus-visible:border-[color:var(--ring)] focus-visible:ring-4 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
