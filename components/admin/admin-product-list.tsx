import { ChevronLeft, ChevronRight, Eye, Plus, Trash2 } from 'lucide-react';

import { StandardTablePage } from '@/components/standard-table-page';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductListItem } from '@/lib/types';
import { formatDateTime } from '@/lib/ui/format';

interface AdminProductListProps {
  products: ProductListItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onCreateProduct?: () => void;
  onOpenDetail: (productKey: string) => void;
  onDeleteProduct: (product: ProductListItem) => void;
}

export function AdminProductList({
  products,
  loading,
  page,
  totalPages,
  totalCount,
  search,
  onSearchChange,
  onPageChange,
  onCreateProduct,
  onOpenDetail,
  onDeleteProduct,
}: AdminProductListProps) {
  const hasSearch = Boolean(search.trim());
  const isPrevDisabled = page <= 1;
  const isNextDisabled = totalCount === 0 || page >= totalPages;

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
      <div className="overflow-hidden rounded-md border">
        <Table className="table-fixed">
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center text-sm text-slate-500">
                  正在加载产品列表…
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && !products.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <span>{hasSearch ? '未找到匹配的产品，请调整搜索关键词。' : '暂无产品，请先创建产品。'}</span>
                    {hasSearch ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => onSearchChange('')}>
                        清空搜索
                      </Button>
                    ) : null}
                    {!hasSearch && onCreateProduct ? (
                      <Button type="button" size="sm" variant="secondary" onClick={onCreateProduct}>
                        <Plus />
                        创建产品
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? products.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex max-w-[120px] truncate rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        <span className="truncate" title={item.key}>
                          {item.key}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.description || '暂无描述'}</TableCell>
                    <TableCell>{item.publishedCount}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
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
                ))
              : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">共 {totalCount} 条记录</div>
          <div className="space-x-2">
            <Button type="button" variant="outline" size="sm" disabled={isPrevDisabled} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft />
              上一页
            </Button>
            <div className="inline-flex items-center justify-center px-2 text-sm font-medium">
              {page} / {totalPages}
            </div>
            <Button type="button" variant="outline" size="sm" disabled={isNextDisabled} onClick={() => onPageChange(page + 1)}>
              下一页
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </StandardTablePage>
  );
}
