import React from 'react';
import { Download, History, Power, Star, Trash2 } from 'lucide-react';

import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductVersionItem } from '@/lib/types';

function StatusTags({ version }: { version: ProductVersionItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip status={version.status} />
      {version.isDefault ? <StatusChip status="offline" label="默认版本" /> : null}
      {version.isLatest ? <StatusChip status="running" label="最新记录" /> : null}
    </div>
  );
}

function formatCreatedAt(createdAt: string) {
  const isoDateTime = createdAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return isoDateTime ? `${isoDateTime[1]} ${isoDateTime[2]}` : createdAt;
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
  if (!versions.length) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-4 text-sm text-slate-500">
        暂无版本记录
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-[color:var(--border)]">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[11%] px-3">版本</TableHead>
            <TableHead className="px-3">标题 / 备注</TableHead>
            <TableHead className="w-[14%] px-3">状态</TableHead>
            <TableHead className="w-[10%] px-3">创建时间</TableHead>
            <TableHead className="w-[48%] px-3">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="px-3 py-4 font-mono text-[13px] font-semibold text-slate-800">{item.version}</TableCell>
              <TableCell className="px-3 py-4">
                <div className="break-words">{item.title || '—'}</div>
                <div className="mt-1 break-words text-sm text-slate-500">{item.remark || '无备注'}</div>
              </TableCell>
              <TableCell className="px-3 py-4">
                <StatusTags version={item} />
              </TableCell>
              <TableCell className="px-3 py-4 whitespace-normal break-all text-[11px] leading-4 text-slate-500">
                {formatCreatedAt(item.createdAt)}
              </TableCell>
              <TableCell className="px-3 py-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => onHistory(item)}>
                    <History />
                    历史
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!item.downloadable}
                    onClick={() => onDownload(item)}
                  >
                    <Download />
                    下载
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={item.isDefault || item.status !== 'published'}
                    onClick={() => onSetDefault(item)}
                  >
                    <Star />
                    设默认
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={item.status !== 'published'}
                    onClick={() => onOffline(item)}
                  >
                    <Power />
                    下线
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(item)}>
                    <Trash2 />
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
