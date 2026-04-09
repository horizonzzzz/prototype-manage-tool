import Link from 'next/link';
import { Search } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ManifestProduct } from '@/lib/types';

interface PreviewProductListProps {
  products: ManifestProduct[];
}

function ProductListContent({ products }: PreviewProductListProps) {
  return products.map((item) => (
    <li key={item.key} className="list-none">
      <Link
        href={`/preview/${item.key}`}
        className="block rounded-[18px] border border-transparent bg-white/70 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-sky-100 hover:bg-white/92"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
            <div className="mt-1 text-xs text-slate-500">{item.versions.length} 个已发布版本</div>
          </div>
          <span className="rounded-full border border-[color:var(--border)] bg-slate-50/90 px-2.5 py-1 font-mono text-[12px] text-slate-500">
            {item.key}
          </span>
        </div>
      </Link>
    </li>
  ));
}

export function PreviewProductList({ products }: PreviewProductListProps) {
  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-5 rounded-[24px] border border-[color:var(--border-strong)] bg-white/88 px-6 py-5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">前端原型统一预览台</h2>
          <p className="mt-1 text-sm text-slate-500">选择一个产品后进入对应版本的独立预览详情页</p>
        </div>
      </section>

      <Card className="rounded-[24px] bg-white/82 backdrop-blur-xl">
        <CardHeader>
          <div>
            <CardTitle>产品列表</CardTitle>
            <CardDescription>点击产品进入子路由预览页</CardDescription>
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
            <div className="flex min-h-56 items-center justify-center rounded-[16px] border border-dashed border-[color:var(--border)] bg-white/70 px-4 text-sm text-slate-500">
              暂无可预览产品
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
