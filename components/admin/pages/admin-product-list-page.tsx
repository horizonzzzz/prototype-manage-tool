'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { ProductCreateDialog } from '@/components/admin/dialogs/product-create-dialog';
import { createProductSchema, type CreateProductFormValues } from '@/components/admin/forms/form-schemas';
import { AdminProductList } from '@/components/admin/panels/admin-product-list';
import { getErrorMessage } from '@/lib/domain/error-message';
import { fetchJson } from '@/lib/ui/api-client';
import { buildAdminHref } from '@/lib/ui/navigation';
import { filterProductsBySearch, paginateProducts } from '@/lib/ui/admin-product-list-view';
import type { ProductListItem } from '@/lib/types';

const PAGE_SIZE = 10;

interface AdminProductListPageProps {
  initialProducts: ProductListItem[];
}

export function AdminProductListPage({ initialProducts }: AdminProductListPageProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { key: '', name: '', description: '' },
  });

  const filteredProducts = useMemo(() => {
    return filterProductsBySearch(products, deferredSearch);
  }, [deferredSearch, products]);

  const paginatedProducts = useMemo(
    () => paginateProducts(filteredProducts, currentPage, PAGE_SIZE),
    [currentPage, filteredProducts],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (paginatedProducts.page !== currentPage) {
      setCurrentPage(paginatedProducts.page);
    }
  }, [currentPage, paginatedProducts.page]);

  const isFiltering = search !== deferredSearch;

  const createProduct = form.handleSubmit(async (values) => {
    try {
      const created = await fetchJson<ProductListItem>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setProducts((current) => [created, ...current]);
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
        products={paginatedProducts.items}
        search={search}
        onSearchChange={setSearch}
        loading={isFiltering}
        page={paginatedProducts.page}
        totalPages={paginatedProducts.totalPages}
        totalCount={paginatedProducts.totalItems}
        onPageChange={setCurrentPage}
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
