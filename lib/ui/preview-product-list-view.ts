import type { ManifestProduct } from '@/lib/types';

export function filterPreviewProducts(products: ManifestProduct[], search: string): ManifestProduct[] {
  const keyword = search.trim().toLowerCase();
  if (!keyword) {
    return products;
  }

  return products.filter((product) => [product.name, product.key].some((value) => value.toLowerCase().includes(keyword)));
}

export function resolveInitialPreviewVersion(product: ManifestProduct, selectedVersion?: string): string | undefined {
  if (selectedVersion && product.versions.some((version) => version.version === selectedVersion)) {
    return selectedVersion;
  }

  return product.defaultVersion ?? product.versions[0]?.version;
}
