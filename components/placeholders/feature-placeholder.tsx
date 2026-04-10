import type { ReactNode } from 'react';
import Link from 'next/link';

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
  tagLabel: _tagLabel,
  demoActionLabel,
  workspaceHref = '/admin',
  workspaceActionLabel = '返回工作台',
  footer,
}: FeaturePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed bg-muted/50 px-4 py-5 text-sm text-muted-foreground">
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
