import Link from 'next/link';
import { Search, Plus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProductListItem } from '@/lib/types';

interface AdminProductListProps {
  products: ProductListItem[];
  onCreateProduct?: () => void;
}

function ProductListContent({ products }: AdminProductListProps) {
  return products.map((item) => (
    <li key={item.id} className="list-none">
      <Link
        href={`/admin/${item.key}`}
        className="block rounded-[18px] border border-transparent bg-white/70 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white/92"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
            <div className="mt-1 text-xs text-slate-500">{item.publishedCount} 个已发布版本</div>
          </div>
          <span className="rounded-full border border-[color:var(--border)] bg-slate-50/90 px-2.5 py-1 font-mono text-[12px] text-slate-500">
            {item.key}
          </span>
        </div>
      </Link>
    </li>
  ));
}

export function AdminProductList({ products, onCreateProduct }: AdminProductListProps) {
  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4 rounded-[24px] border border-[color:var(--border-strong)] bg-white/88 px-6 py-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">原型发布管理台</h2>
          <p className="mt-1 text-sm text-slate-500">选择产品后进入独立管理详情页</p>
        </div>
        {onCreateProduct ? (
          <Button type="button" className="h-10 px-4" onClick={onCreateProduct}>
            <Plus />新建产品
          </Button>
        ) : null}
      </section>

      <Card className="rounded-[24px] bg-white/82 backdrop-blur-xl">
        <CardHeader>
          <div>
            <CardTitle>产品列表</CardTitle>
            <CardDescription>点击产品进入上传、版本与任务详情</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="按产品名称搜索" className="pl-9" disabled />
          </div>

          {products.length ? (
            <ul className="space-y-2">
              <ProductListContent products={products} />
            </ul>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-[16px] border border-dashed border-[color:var(--border)] bg-white/70 px-4 text-sm text-slate-500">
              <span>暂无产品</span>
              {onCreateProduct ? (
                <Button type="button" variant="secondary" onClick={onCreateProduct}>
                  <Plus />创建第一个产品
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
