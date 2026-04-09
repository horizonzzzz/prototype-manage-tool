export type AppNavigationItem = {
  href: '/preview' | '/admin';
  label: string;
  description: string;
  match: (pathname: string) => boolean;
};

function matchesRoutePrefix(pathname: string, prefix: '/preview' | '/admin') {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    href: '/preview',
    label: '预览台',
    description: '浏览已发布原型与版本',
    match: (pathname) => pathname === '/' || matchesRoutePrefix(pathname, '/preview'),
  },
  {
    href: '/admin',
    label: '管理台',
    description: '管理产品、上传与发布流程',
    match: (pathname) => matchesRoutePrefix(pathname, '/admin'),
  },
];

export function buildPreviewHref(productKey?: string, version?: string) {
  if (!productKey) {
    return '/preview';
  }

  if (!version) {
    return `/preview/${productKey}`;
  }

  return `/preview/${productKey}/${version}`;
}

export function buildAdminHref(productKey?: string) {
  if (!productKey) {
    return '/admin';
  }

  return `/admin/${productKey}`;
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
