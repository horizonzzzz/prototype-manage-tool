import { Eye, Plus, Trash2 } from 'lucide-react';

import { StandardTablePage } from '@/components/standard-table-page';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductListItem } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';

interface AdminProductListProps {
  products: ProductListItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreateProduct?: () => void;
  onOpenDetail: (productKey: string) => void;
  onDeleteProduct: (product: ProductListItem) => void;
}

export function AdminProductList({
  products,
  search,
  onSearchChange,
  onCreateProduct,
  onOpenDetail,
  onDeleteProduct,
}: AdminProductListProps) {
  return (
    <StandardTablePage
      title="原型发布管理台"
      description="按产品维度管理原型版本，进入详情页后处理上传、版本发布和历史记录。"
      tableTitle="产品列表"
      tableDescription="列表仅展示产品，所有版本级操作统一在产品详情页处理。"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="搜索产品名称或 Key"
      actions={
        onCreateProduct ? (
          <Button type="button" onClick={onCreateProduct}>
            <Plus />
            创建产品
          </Button>
        ) : null
      }
    >
      {products.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[24%]">产品名称</TableHead>
              <TableHead className="w-[16%]">产品 Key</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="w-[12%]">已发布版本</TableHead>
              <TableHead className="w-[16%]">创建时间</TableHead>
              <TableHead className="w-[18%]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                <TableCell>
                  <span className="inline-flex rounded-full border border-[color:var(--border)] bg-slate-50 px-3 py-1 font-mono text-[12px] text-slate-600">
                    {item.key}
                  </span>
                </TableCell>
                <TableCell className="text-sm leading-6 text-slate-500">{item.description || '暂无描述'}</TableCell>
                <TableCell className="font-medium text-slate-900">{item.publishedCount}</TableCell>
                <TableCell className="text-xs leading-5 text-slate-500">{formatDateTime(item.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => onOpenDetail(item.key)}>
                      <Eye />
                      详情
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => onDeleteProduct(item)}>
                      <Trash2 />
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-sm text-slate-500">
          <span>暂无产品</span>
          {onCreateProduct ? (
            <Button type="button" variant="secondary" onClick={onCreateProduct}>
              <Plus />
              创建产品
            </Button>
          ) : null}
        </div>
      )}
    </StandardTablePage>
  );
}
