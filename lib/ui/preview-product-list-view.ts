import type { ManifestProduct, ProductVersionManifest } from '@/lib/types';

export type PreviewVersionSelections = Record<string, string | undefined>;

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

export function findPreviewVersion(product: ManifestProduct, selectedVersion?: string): ProductVersionManifest | undefined {
  return product.versions.find((item) => item.version === selectedVersion) ?? product.versions[0];
}

export function createPreviewVersionSelections(
  products: ManifestProduct[],
  selectedProductKey?: string,
  selectedVersion?: string,
): PreviewVersionSelections {
  return Object.fromEntries(
    products.map((product) => [
      product.key,
      resolveInitialPreviewVersion(product, product.key === selectedProductKey ? selectedVersion : undefined),
    ]),
  );
}

export function syncPreviewVersionSelections(
  currentSelections: PreviewVersionSelections,
  products: ManifestProduct[],
  selectedProductKey?: string,
  selectedVersion?: string,
): PreviewVersionSelections {
  return {
    ...currentSelections,
    ...Object.fromEntries(
      products.map((product) => [
        product.key,
        resolveInitialPreviewVersion(
          product,
          product.key === selectedProductKey ? selectedVersion : currentSelections[product.key],
        ),
      ]),
    ),
  };
}
