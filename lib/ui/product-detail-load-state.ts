import { getErrorMessage } from '@/lib/domain/error-message';
import { isApiClientError } from '@/lib/ui/api-client';

type ProductDetailLoadFailure = {
  productMissing: boolean;
  message: string;
};

export function resolveProductDetailLoadFailure(error: unknown, fallback: string): ProductDetailLoadFailure {
  const message = getErrorMessage(error, fallback);

  return {
    productMissing: isApiClientError(error) && error.status === 404,
    message,
  };
}
