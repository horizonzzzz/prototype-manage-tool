import { PreviewProductList } from '@/components/preview/preview-product-list';
import type { ManifestProduct } from '@/lib/types';

type PreviewBrowserProps = {
  products: ManifestProduct[];
  selectedProductKey?: string;
  selectedVersion?: string;
};

export function PreviewBrowser({ products, selectedProductKey, selectedVersion }: PreviewBrowserProps) {
  return (
    <PreviewProductList
      products={products}
      selectedProductKey={selectedProductKey}
      selectedVersion={selectedVersion}
    />
  );
}
