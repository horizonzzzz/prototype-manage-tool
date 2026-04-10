import * as React from 'react';

import { cn } from '@/lib/utils';

function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="avatar" className={cn('relative flex size-8 shrink-0 rounded-full select-none ring-1 ring-border', className)} {...props} />;
}

function AvatarImage({ className, alt = '', ...props }: React.ComponentProps<'img'>) {
  return <img alt={alt} data-slot="avatar-image" className={cn('aspect-square size-full rounded-full object-cover', className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="avatar-fallback" className={cn('flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground', className)} {...props} />;
}

export { Avatar, AvatarFallback, AvatarImage };
