import { LayoutDashboard, PanelsTopLeft, Settings, Users, type LucideIcon } from 'lucide-react';

export type AppNavigationItem = {
  href: '/admin' | '/preview' | '/users' | '/settings';
  icon: LucideIcon;
  label: string;
  description: string;
  match: (pathname: string) => boolean;
};

function matchesRoutePrefix(pathname: string, prefix: AppNavigationItem['href']) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    href: '/admin',
    icon: LayoutDashboard,
    label: '管理台',
    description: '管理产品、上传与发布流程',
    match: (pathname) => matchesRoutePrefix(pathname, '/admin'),
  },
  {
    href: '/preview',
    icon: PanelsTopLeft,
    label: '预览台',
    description: '浏览已发布原型与版本',
    match: (pathname) => matchesRoutePrefix(pathname, '/preview'),
  },
  {
    href: '/users',
    icon: Users,
    label: '用户中心',
    description: '用户与权限占位页',
    match: (pathname) => matchesRoutePrefix(pathname, '/users'),
  },
  {
    href: '/settings',
    icon: Settings,
    label: '系统设置',
    description: '偏好与系统配置入口',
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
