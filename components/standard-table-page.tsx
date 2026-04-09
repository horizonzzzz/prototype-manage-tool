import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type StandardTablePageProps = {
  title: string;
  description: string;
  tableTitle: string;
  tableDescription?: string;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  actions?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

export function StandardTablePage({
  title,
  description,
  tableTitle,
  tableDescription,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  actions,
  headerActions,
  children,
  contentClassName,
}: StandardTablePageProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[color:var(--border-strong)] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Standard Workspace</div>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
          {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
        </div>
      </section>

      <Card className="rounded-[18px] border-[color:var(--border-strong)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="flex-col items-stretch gap-4 border-b border-[color:var(--border)] bg-slate-50/70 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <CardTitle>{tableTitle}</CardTitle>
            {tableDescription ? <CardDescription>{tableDescription}</CardDescription> : null}
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-[280px] max-w-full xl:w-[320px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 shadow-none"
              />
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </CardHeader>
        <CardContent className={cn('px-0 py-0', contentClassName)}>{children}</CardContent>
      </Card>
    </div>
  );
}

