'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AdminProductList } from '@/components/admin/admin-product-list';
import { ProductCreateDialog } from '@/components/admin/product-create-dialog';
import { createProductSchema, type CreateProductFormValues } from '@/components/admin/form-schemas';
import { buildAdminHref } from '@/lib/ui/navigation';
import type { ApiResponse, ProductListItem } from '@/lib/types';

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data as T;
}

interface AdminProductListPageProps {
  initialProducts: ProductListItem[];
}

export function AdminProductListPage({ initialProducts }: AdminProductListPageProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [createOpen, setCreateOpen] = useState(false);
  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { key: '', name: '', description: '' },
  });

  const createProduct = form.handleSubmit(async (values) => {
    try {
      const created = await fetchJson<ProductListItem>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setProducts((current) => [...current, created]);
      setCreateOpen(false);
      form.reset();
      toast.success('产品创建成功');
      router.push(buildAdminHref(created.key));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '产品创建失败');
    }
  });

  return (
    <>
      <AdminProductList products={products} onCreateProduct={() => setCreateOpen(true)} />
      <ProductCreateDialog open={createOpen} onOpenChange={setCreateOpen} form={form} onSubmit={createProduct} />
    </>
  );
}
