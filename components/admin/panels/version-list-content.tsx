'use client';

import React from 'react';
import { CheckCircle2, CircleDashed, Download, MoreHorizontal, Power, PowerOff, Star, TerminalSquare, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductVersionItem } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';
import { getVersionStatusLabel, isVersionActionEnabled } from '@/lib/ui/product-detail-view';

function VersionStatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {getVersionStatusLabel(status)}
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        <XCircle className="mr-1 h-3 w-3" />
        {getVersionStatusLabel(status)}
      </Badge>
    );
  }

  if (status === 'offline') {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
        <PowerOff className="mr-1 h-3 w-3" />
        {getVersionStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      <CircleDashed className="mr-1 h-3 w-3 animate-spin" />
      {getVersionStatusLabel(status)}
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
  return (
    <div className="overflow-hidden rounded-[16px] border border-[color:var(--border)]">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[18%] px-3">版本号</TableHead>
            <TableHead className="w-[16%] px-3">状态</TableHead>
            <TableHead className="px-3">描述</TableHead>
            <TableHead className="w-[16%] px-3">上传时间</TableHead>
            <TableHead className="w-[16%] px-3">操作</TableHead>
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
                        默认版本
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-4">
                  <VersionStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="px-3 py-4 text-muted-foreground">{item.remark || item.title || '—'}</TableCell>
                <TableCell className="px-3 py-4 text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                <TableCell className="px-3 py-4">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onHistory(item)}
                      title="查看构建日志"
                      aria-label="查看构建日志"
                    >
                      <TerminalSquare />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label={`更多操作 ${item.version}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!item.downloadable} onSelect={() => onDownload(item)}>
                          <Download />
                          下载源码
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isVersionActionEnabled('setDefault', item)}
                          onSelect={() => onSetDefault(item)}
                        >
                          <Star />
                          设为默认
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!isVersionActionEnabled('offline', item)} onSelect={() => onOffline(item)}>
                          <Power />
                          下线版本
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onSelect={() => onDelete(item)}>
                          <Trash2 />
                          删除版本
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
                暂无版本
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
