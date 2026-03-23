export function buildPreviewHref(productKey?: string, version?: string) {
  if (!productKey) {
    return '/preview';
  }

  const query = new URLSearchParams();
  query.set('product', productKey);

  if (version) {
    query.set('version', version);
  }

  return `/preview?${query.toString()}`;
}

export function buildAdminHref(productKey?: string) {
  if (!productKey) {
    return '/admin';
  }

  const query = new URLSearchParams();
  query.set('product', productKey);
  return `/admin?${query.toString()}`;
}

export function resolveAdminProductKey(productKeys: string[], requestedProductKey?: string | null) {
  if (!productKeys.length) {
    return undefined;
  }

  if (requestedProductKey && productKeys.includes(requestedProductKey)) {
    return requestedProductKey;
  }

  return productKeys[0];
}
