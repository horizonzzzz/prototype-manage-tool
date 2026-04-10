import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase', {
  variants: {
    variant: {
      default: 'border-transparent bg-muted text-muted-foreground',
      secondary: 'border-border bg-background text-muted-foreground',
      destructive: 'border-red-200 bg-red-50 text-red-700',
      outline: 'border-border bg-transparent text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
