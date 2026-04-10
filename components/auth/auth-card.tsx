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
  brandTitle?: string;
  children: ReactNode;
}

export function AuthCard({
  title,
  description,
  footerText,
  footerActionLabel,
  footerActionHref,
  brandTitle = 'Prototype Management System',
  children,
}: AuthCardProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Layers3 className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{brandTitle}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          <div className="mt-4 text-center text-sm">
            {footerText}{' '}
            <Link href={footerActionHref} className="underline underline-offset-4">
              {footerActionLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
