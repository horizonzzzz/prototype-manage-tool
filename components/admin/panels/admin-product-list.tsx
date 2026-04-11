import { ChevronLeft, ChevronRight, Eye, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">原型发布管理台</h2>
          <p className="text-muted-foreground">按产品维度管理原型版本，进入详情页后处理上传、版本发布和历史记录。</p>
        </div>
        {onCreateProduct ? (
          <Button type="button" onClick={onCreateProduct}>
            <Plus className="mr-2 h-4 w-4" />
            创建产品
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="font-semibold leading-none tracking-tight">产品列表</h3>
          <p className="text-sm text-muted-foreground">列表仅展示产品，所有版本级操作统一在产品详情页处理。</p>
        </div>
        <div className="p-6 pt-0">
          <div className="flex items-center py-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索产品名称或 Key"
                className="pl-8"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品名称</TableHead>
                  <TableHead>产品 Key</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>已发布版本</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      正在加载产品列表…
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && !products.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {hasSearch ? '未找到匹配的产品' : '暂无产品'}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading
                  ? products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            {product.key}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.description || '暂无描述'}</TableCell>
                        <TableCell>{product.publishedCount}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(product.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenDetail(product.key)}>
                              <Eye className="mr-2 h-4 w-4" />
                              详情
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => onDeleteProduct(product)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </div>

          {totalCount > 0 ? (
            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="flex-1 text-sm text-muted-foreground">共 {totalCount} 条记录</div>
              <div className="space-x-2">
                <Button type="button" variant="outline" size="sm" disabled={isPrevDisabled} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <div className="inline-flex items-center justify-center px-2 text-sm font-medium">
                  {page} / {totalPages}
                </div>
                <Button type="button" variant="outline" size="sm" disabled={isNextDisabled} onClick={() => onPageChange(page + 1)}>
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
