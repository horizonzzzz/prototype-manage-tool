import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva('rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-soft)]', {
  variants: {
    variant: {
      default: 'border-[color:var(--border)] bg-white/92 text-slate-700',
      info: 'border-[color:color-mix(in_srgb,var(--primary)_16%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]',
      success: 'border-[color:color-mix(in_srgb,var(--success)_18%,transparent)] bg-[var(--success-soft)] text-[var(--success)]',
      destructive: 'border-[color:color-mix(in_srgb,var(--destructive)_18%,transparent)] bg-[var(--destructive-soft)] text-[var(--destructive)]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mt-1 text-sm/6 opacity-90', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
