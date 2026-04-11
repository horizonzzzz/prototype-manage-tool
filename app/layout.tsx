import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { AppFrame } from '@/components/layout/app-frame';
import { ThemeScript } from '@/components/layout/theme-script';

import './globals.css';

export const metadata: Metadata = {
  title: 'Prototype Manage Tool',
  description: 'Front-end prototype publishing and preview tool',
};

function resolveHtmlLang(locale: string) {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={resolveHtmlLang(locale)} suppressHydrationWarning>
      <body>
        <ThemeScript />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppFrame>{children}</AppFrame>
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
