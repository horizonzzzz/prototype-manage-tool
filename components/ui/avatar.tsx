import * as React from 'react';

import { cn } from '@/lib/utils';

export type AvatarImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

type AvatarContextValue = {
  imageStatus: AvatarImageStatus;
  setImageStatus: React.Dispatch<React.SetStateAction<AvatarImageStatus>>;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

export function resolveAvatarImageVisibility(src: string | null | undefined, status: AvatarImageStatus) {
  return Boolean(src?.trim()) && status !== 'error';
}

export function resolveAvatarFallbackVisibility(status: AvatarImageStatus) {
  return status !== 'loaded';
}

function Avatar({ className, children, ...props }: React.ComponentProps<'span'>) {
  const [imageStatus, setImageStatus] = React.useState<AvatarImageStatus>('idle');

  return (
    <AvatarContext.Provider value={{ imageStatus, setImageStatus }}>
      <span
        data-slot="avatar"
        className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full select-none ring-1 ring-border', className)}
        {...props}
      >
        {children}
      </span>
    </AvatarContext.Provider>
  );
}

function AvatarImage({ className, alt = '', onError, onLoad, src, ...props }: React.ComponentProps<'img'>) {
  const context = React.useContext(AvatarContext);
  const normalizedSrc = typeof src === 'string' ? src : undefined;

  React.useEffect(() => {
    context?.setImageStatus(normalizedSrc?.trim() ? 'loading' : 'error');
  }, [context, normalizedSrc]);

  if (!resolveAvatarImageVisibility(normalizedSrc, context?.imageStatus ?? 'idle')) {
    return null;
  }

  return (
    <img
      alt={alt}
      data-slot="avatar-image"
      className={cn('absolute inset-0 z-10 aspect-square size-full rounded-full object-cover', className)}
      src={normalizedSrc}
      onError={(event) => {
        context?.setImageStatus('error');
        onError?.(event);
      }}
      onLoad={(event) => {
        context?.setImageStatus('loaded');
        onLoad?.(event);
      }}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<'span'>) {
  const context = React.useContext(AvatarContext);

  if (!resolveAvatarFallbackVisibility(context?.imageStatus ?? 'idle')) {
    return null;
  }

  return (
    <span
      data-slot="avatar-fallback"
      className={cn('absolute inset-0 z-0 flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
