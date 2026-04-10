import * as React from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'overflow-hidden rounded-[18px] border border-[color:var(--border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_96%,transparent),color-mix(in_srgb,var(--secondary)_92%,transparent))] text-[color:var(--card-foreground)] shadow-[var(--shadow-panel)]',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--secondary)_96%,transparent),color-mix(in_srgb,var(--card)_84%,transparent))] px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('text-[15px] font-semibold text-[color:var(--foreground)]', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-sm text-[color:var(--muted-foreground)]', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6 py-6', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
