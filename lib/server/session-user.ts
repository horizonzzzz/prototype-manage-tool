import { redirect } from 'next/navigation';

import { auth } from '@/auth';

export function buildLocalizedHref(locale: string, href: string) {
  const normalizedHref = href.startsWith('/') ? href : `/${href}`;
  return `/${locale}${normalizedHref}`;
}

export async function getSessionUser() {
  return (await auth())?.user ?? null;
}

export async function requirePageUser(locale: string) {
  const user = await getSessionUser();
  if (!user?.id) {
    redirect(buildLocalizedHref(locale, '/login'));
  }

  return user;
}

export async function redirectAuthenticatedUser(locale: string) {
  const user = await getSessionUser();
  if (user?.id) {
    redirect(buildLocalizedHref(locale, '/admin'));
  }

  return user;
}
