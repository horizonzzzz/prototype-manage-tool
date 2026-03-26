import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-linear-to-br from-[var(--primary)] to-[var(--primary-strong)] text-white shadow-[0_14px_32px_rgba(37,99,235,0.22)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(37,99,235,0.28)]',
        secondary:
          'border border-[color:var(--border-strong)] bg-white/92 text-slate-700 shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:bg-white',
        outline:
          'border border-[color:var(--border-strong)] bg-[var(--panel-soft)] text-slate-700 hover:bg-white',
        ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        destructive:
          'bg-[color:var(--destructive)] text-white shadow-[0_14px_32px_rgba(220,38,38,0.18)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(220,38,38,0.24)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
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
