import { KeyRound, LayoutDashboard, PanelsTopLeft, Settings, type LucideIcon } from 'lucide-react';

export type AppNavigationItem = {
  href: '/admin' | '/preview' | '/mcp' | '/settings';
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

function matchesRoutePrefix(pathname: string, prefix: AppNavigationItem['href']) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    href: '/admin',
    icon: LayoutDashboard,
    match: (pathname) => matchesRoutePrefix(pathname, '/admin'),
  },
  {
    href: '/preview',
    icon: PanelsTopLeft,
    match: (pathname) => matchesRoutePrefix(pathname, '/preview'),
  },
  {
    href: '/mcp',
    icon: KeyRound,
    match: (pathname) => matchesRoutePrefix(pathname, '/mcp'),
  },
  {
    href: '/settings',
    icon: Settings,
    match: (pathname) => matchesRoutePrefix(pathname, '/settings'),
  },
];

export const workspaceRouteHrefs = appNavigationItems.map((item) => item.href);

export function isWorkspaceNavigationRoute(pathname: string) {
  return appNavigationItems.some((item) => item.match(pathname));
}

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
