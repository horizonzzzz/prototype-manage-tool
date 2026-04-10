import type { ReactNode } from 'react';
import Link from 'next/link';
import { Layers3 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthCardProps {
  title: string;
  description: string;
  footerText: string;
  footerActionLabel: string;
  footerActionHref: string;
  children: ReactNode;
}

export function AuthCard({ title, description, footerText, footerActionLabel, footerActionHref, children }: AuthCardProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-white shadow-[var(--shadow-soft)]">
          <Layers3 className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">Prototype Manage Tool</h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">原型管理控制台演示入口</p>
        </div>
      </div>

      <Card className="bg-[color:var(--card)]">
        <CardHeader className="items-start">
          <div>
            <CardTitle className="text-lg text-[color:var(--foreground)]">{title}</CardTitle>
            <CardDescription className="mt-1 text-[color:var(--muted-foreground)]">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {children}
          <p className="mt-5 text-center text-sm text-[color:var(--muted-foreground)]">
            {footerText}{' '}
            <Link href={footerActionHref} className="font-medium text-[color:var(--primary)] underline-offset-4 hover:underline">
              {footerActionLabel}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
