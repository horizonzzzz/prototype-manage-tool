import { Eye, Power, Star, Trash2 } from 'lucide-react';

import { StatusChip } from '@/components/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductDetail, ProductVersionItem } from '@/lib/types';

function StatusTags({ version }: { version: ProductVersionItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip status={version.status} />
      {version.isDefault ? <StatusChip status="offline" label="默认版本" /> : null}
      {version.isLatest ? <StatusChip status="running" label="最新记录" /> : null}
    </div>
  );
}

type VersionListContentProps = {
  versions: ProductVersionItem[];
  productDetail: ProductDetail | null;
  onPreview: (item: ProductVersionItem) => void;
  onSetDefault: (item: ProductVersionItem) => void;
  onOffline: (item: ProductVersionItem) => void;
  onDelete: (item: ProductVersionItem) => void;
};

export function VersionListContent({
  versions,
  productDetail,
  onPreview,
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">版本</TableHead>
            <TableHead>标题 / 备注</TableHead>
            <TableHead className="w-[190px]">状态</TableHead>
            <TableHead className="w-[180px]">创建时间</TableHead>
            <TableHead className="w-[320px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-[13px] font-semibold text-slate-800">{item.version}</TableCell>
              <TableCell>
                <div>{item.title || '—'}</div>
                <div className="mt-1 text-sm text-slate-500">{item.remark || '无备注'}</div>
              </TableCell>
              <TableCell>
                <StatusTags version={item} />
              </TableCell>
              <TableCell>{item.createdAt}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!item.entryUrl || item.status !== 'published' || !productDetail}
                    onClick={() => onPreview(item)}
                  >
                    <Eye />
                    预览
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
