import type { ManifestProduct } from '@/lib/types';
import { resolveInitialPreviewVersion } from '@/lib/ui/preview-product-list-view';

export type PreviewViewerState = {
  isOpen: boolean;
  productKey?: string;
  version?: string;
};

export function buildPreviewStateHref(productKey?: string, version?: string) {
  if (!productKey) {
    return '/preview';
  }

  const searchParams = new URLSearchParams();
  if (version) {
    searchParams.set('v', version);
  }

  const query = searchParams.toString();
  return query ? `/preview/${productKey}?${query}` : `/preview/${productKey}`;
}

export function resolvePreviewViewerState(
  products: ManifestProduct[],
  selectedProductKey?: string,
  selectedVersion?: string,
): PreviewViewerState {
  if (!selectedProductKey) {
    return { isOpen: false };
  }

  const product = products.find((item) => item.key === selectedProductKey);
  if (!product) {
    return { isOpen: false };
  }

  const version = resolveInitialPreviewVersion(product, selectedVersion);
  if (!version) {
    return { isOpen: false };
  }

  return {
    isOpen: true,
    productKey: product.key,
    version,
  };
}
