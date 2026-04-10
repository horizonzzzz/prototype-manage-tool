import type { ProductListItem } from '@/lib/types';

export type ProductPaginationResult = {
  items: ProductListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function filterProductsBySearch(products: ProductListItem[], search: string): ProductListItem[] {
  const keyword = search.trim().toLowerCase();
  if (!keyword) {
    return products;
  }

  return products.filter((product) =>
    [product.name, product.key, product.description ?? ''].some((value) => value.toLowerCase().includes(keyword)),
  );
}

export function paginateProducts(products: ProductListItem[], page: number, pageSize: number): ProductPaginationResult {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = products.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (currentPage - 1) * normalizedPageSize;

  return {
    items: products.slice(start, start + normalizedPageSize),
    page: currentPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
  };
}
