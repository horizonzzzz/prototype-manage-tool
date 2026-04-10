import * as React from 'react';

import { cn } from '@/lib/utils';

function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)} {...props} />;
}

function AvatarImage({ className, alt = '', ...props }: React.ComponentProps<'img'>) {
  return <img alt={alt} className={cn('aspect-square size-full object-cover', className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex size-full items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary-strong)]',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
