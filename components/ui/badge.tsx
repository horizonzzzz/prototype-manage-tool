import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--primary-soft)] text-[var(--primary-strong)]',
        secondary: 'border-[color:var(--border)] bg-white/90 text-slate-600',
        destructive: 'border-transparent bg-[var(--destructive-soft)] text-[var(--destructive)]',
        outline: 'border-[color:var(--border-strong)] bg-transparent text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
