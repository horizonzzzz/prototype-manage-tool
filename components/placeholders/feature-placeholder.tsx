import type { ReactNode } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  tagLabel: string;
  demoActionLabel: string;
  workspaceHref?: string;
  workspaceActionLabel?: string;
  footer?: ReactNode;
}

export function FeaturePlaceholder({
  title,
  description,
  tagLabel,
  demoActionLabel,
  workspaceHref = '/admin',
  workspaceActionLabel = '返回工作台',
  footer,
}: FeaturePlaceholderProps) {
  return (
    <Card className="bg-[color:var(--card)]">
      <CardHeader className="items-start">
        <Badge className="rounded-full border border-[color:var(--border)] bg-[color:var(--primary-soft)] px-3 py-1 text-xs text-[color:var(--primary-strong)]">
          {tagLabel}
        </Badge>
        <div>
          <CardTitle className="text-lg text-[color:var(--foreground)]">{title}</CardTitle>
          <CardDescription className="mt-1 text-[color:var(--muted-foreground)]">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--secondary)] px-4 py-5 text-sm text-[color:var(--muted-foreground)]">
          当前页面作为功能占位，用于验证布局、导航和主题切换表现。
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={workspaceHref}>{workspaceActionLabel}</Link>
          </Button>
          <Button variant="outline" disabled aria-disabled>
            {demoActionLabel}
          </Button>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
