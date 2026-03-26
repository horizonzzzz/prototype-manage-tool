import type { ProductDetail } from '@/lib/types';

type ProductInfoContentProps = {
  productDetail: ProductDetail | null;
};

export function ProductInfoContent({ productDetail }: ProductInfoContentProps) {
  if (!productDetail) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-[18px] border border-dashed border-[color:var(--border)] bg-slate-50/70 px-4 text-sm text-slate-500">
        请选择产品
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs text-slate-500">产品名称</div>
        <div className="text-[15px] font-semibold text-slate-900">{productDetail.name}</div>
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-500">产品 Key</div>
        <div className="inline-flex rounded-xl border border-[color:var(--border)] bg-slate-50/92 px-3 py-2 font-mono text-[13px] text-slate-700">
          {productDetail.key}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-500">描述</div>
        <div className="text-sm leading-6 text-slate-500">{productDetail.description || '暂无描述'}</div>
      </div>
    </div>
  );
}
