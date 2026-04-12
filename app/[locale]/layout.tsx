import type { ReactNode } from 'react';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { AppFrame } from '@/components/layout/app-frame';
import { AuthSessionProvider } from '@/components/providers/auth-session-provider';
import { routing } from '@/i18n/routing';

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const session = await auth();
  const messages = await getMessages();

  return (
    <AuthSessionProvider session={session}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AppFrame>{children}</AppFrame>
      </NextIntlClientProvider>
    </AuthSessionProvider>
  );
}
