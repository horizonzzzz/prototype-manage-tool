import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PanelCardProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export function PanelCard({
  title,
  description,
  actions,
  loading = false,
  className,
  contentClassName,
  children,
}: PanelCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn(contentClassName, loading && 'space-y-4')}>
        {loading ? (
          <>
            <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100/90" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100/80" />
          </>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
