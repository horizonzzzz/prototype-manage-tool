'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { AdminProductList } from '@/components/admin/admin-product-list';
import { ProductCreateDialog } from '@/components/admin/product-create-dialog';
import { createProductSchema, type CreateProductFormValues } from '@/components/admin/form-schemas';
import { getErrorMessage } from '@/lib/domain/error-message';
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
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { key: '', name: '', description: '' },
  });

  const filteredProducts = useMemo(() => {
    if (!deferredSearch) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.key].some((value) => value.toLowerCase().includes(deferredSearch)),
    );
  }, [deferredSearch, products]);

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
      toast.error(getErrorMessage(error, '产品创建失败'));
    }
  });

  const deleteProduct = async () => {
    if (!productToDelete) {
      return;
    }

    try {
      setDeleting(true);
      await fetchJson(`/api/products/${productToDelete.key}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.key !== productToDelete.key));
      toast.success('产品已删除');
      setProductToDelete(null);
    } catch (error) {
      toast.error(getErrorMessage(error, '产品删除失败'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AdminProductList
        products={filteredProducts}
        search={search}
        onSearchChange={setSearch}
        onCreateProduct={() => setCreateOpen(true)}
        onOpenDetail={(productKey) => router.push(buildAdminHref(productKey))}
        onDeleteProduct={setProductToDelete}
      />

      <ProductCreateDialog open={createOpen} onOpenChange={setCreateOpen} form={form} onSubmit={createProduct} />

      <ConfirmDialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title={productToDelete ? `删除产品 ${productToDelete.name}` : '删除产品'}
        description="删除后会移除该产品下的所有版本、任务记录和已发布文件，请确认。"
        confirmLabel="删除"
        confirmVariant="destructive"
        pending={deleting}
        onConfirm={deleteProduct}
      />
    </>
  );
}
