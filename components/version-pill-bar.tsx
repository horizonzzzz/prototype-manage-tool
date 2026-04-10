import { MoreHorizontal } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/status-chip';
import type { ProductVersionManifest } from '@/lib/types';
import { cn } from '@/lib/utils';

type VersionPillBarProps = {
  currentVersion?: string;
  visibleVersions: ProductVersionManifest[];
  overflowVersions: ProductVersionManifest[];
  onSelect: (version: string) => void;
};

function VersionIndicators({ version }: { version: ProductVersionManifest }) {
  return (
    <>
      {version.isDefault ? <StatusChip status="offline" label="默认" showDot={false} className="tracking-[0.12em]" /> : null}
      {version.isLatest ? <StatusChip status="running" label="最新" showDot={false} className="tracking-[0.12em]" /> : null}
    </>
  );
}

export function VersionPillBar({ currentVersion, visibleVersions, overflowVersions, onSelect }: VersionPillBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2">
      {visibleVersions.map((item) => {
        const isActive = currentVersion === item.version;

        return (
          <Button
            key={item.version}
            type="button"
            variant={isActive ? 'default' : 'ghost'}
            className={cn(
              'h-10 rounded-xl px-4 font-mono text-[13px]',
              !isActive && 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
            onClick={() => onSelect(item.version)}
          >
            <span>{item.version}</span>
            <VersionIndicators version={item} />
          </Button>
        );
      })}

      {overflowVersions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-4">
              <MoreHorizontal />
              更多版本
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflowVersions.map((item) => (
              <DropdownMenuItem key={item.version} onClick={() => onSelect(item.version)} className="flex items-center justify-between gap-3">
                <span className="font-mono text-[13px]">{item.version}</span>
                <span className="flex items-center gap-1">
                  <VersionIndicators version={item} />
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
