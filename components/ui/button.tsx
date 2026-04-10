import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all outline-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-linear-to-br from-[var(--primary)] to-[var(--primary-strong)] text-white shadow-[0_14px_32px_rgba(37,99,235,0.22)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(37,99,235,0.28)]',
        secondary:
          'border border-[color:var(--border-strong)] bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:bg-[color:var(--accent)]',
        outline:
          'border border-[color:var(--border-strong)] bg-[color:var(--panel-soft)] text-[color:var(--secondary-foreground)] hover:bg-[color:var(--accent)]',
        ghost: 'text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)]',
        destructive:
          'bg-[color:var(--destructive)] text-white shadow-[0_14px_32px_rgba(220,38,38,0.18)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(220,38,38,0.24)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-2 text-[11px] gap-1 [&_svg]:size-3.5',
        lg: 'h-11 px-5 text-sm',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
