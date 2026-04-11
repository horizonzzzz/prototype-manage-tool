'use client';

import React from 'react';
import { CheckCircle2, CircleDashed, Download, MoreHorizontal, Power, PowerOff, Star, TerminalSquare, Trash2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductVersionItem } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';
import { getVersionStatusMessageKey, isVersionActionEnabled } from '@/lib/ui/product-detail-view';

function VersionStatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.versionStatus');
  const label = t(getVersionStatusMessageKey(status));

  if (status === 'published') {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        <XCircle className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }

  if (status === 'offline') {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
        <PowerOff className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      <CircleDashed className="mr-1 h-3 w-3 animate-spin" />
      {label}
    </Badge>
  );
}

type VersionListContentProps = {
  versions: ProductVersionItem[];
  onHistory: (item: ProductVersionItem) => void;
  onDownload: (item: ProductVersionItem) => void;
  onSetDefault: (item: ProductVersionItem) => void;
  onOffline: (item: ProductVersionItem) => void;
  onDelete: (item: ProductVersionItem) => void;
};

export function VersionListContent({
  versions,
  onHistory,
  onDownload,
  onSetDefault,
  onOffline,
  onDelete,
}: VersionListContentProps) {
  const t = useTranslations('admin.versionList');

  return (
    <div className="overflow-hidden rounded-[16px] border border-[color:var(--border)]">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[18%] px-3">{t('columns.version')}</TableHead>
            <TableHead className="w-[16%] px-3">{t('columns.status')}</TableHead>
            <TableHead className="px-3">{t('columns.description')}</TableHead>
            <TableHead className="w-[16%] px-3">{t('columns.createdAt')}</TableHead>
            <TableHead className="w-[16%] px-3">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.length ? (
            versions.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-slate-800">{item.version}</span>
                    {item.isDefault ? (
                      <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-100">
                        {t('default')}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-4">
                  <VersionStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="px-3 py-4 text-muted-foreground">{item.remark || item.title || t('notAvailable')}</TableCell>
                <TableCell className="px-3 py-4 text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                <TableCell className="px-3 py-4">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onHistory(item)}
                      title={t('history')}
                      aria-label={t('history')}
                    >
                      <TerminalSquare />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('moreActions', { version: item.version })}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!item.downloadable} onSelect={() => onDownload(item)}>
                          <Download />
                          {t('download')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isVersionActionEnabled('setDefault', item)}
                          onSelect={() => onSetDefault(item)}
                        >
                          <Star />
                          {t('setDefault')}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!isVersionActionEnabled('offline', item)} onSelect={() => onOffline(item)}>
                          <Power />
                          {t('offline')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onSelect={() => onDelete(item)}>
                          <Trash2 />
                          {t('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                {t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
