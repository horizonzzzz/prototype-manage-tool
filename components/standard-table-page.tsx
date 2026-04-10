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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
      </section>

      <Card>
        <CardHeader className="flex-col items-stretch gap-4 border-b xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>{tableTitle}</CardTitle>
            {tableDescription ? <CardDescription>{tableDescription}</CardDescription> : null}
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
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
