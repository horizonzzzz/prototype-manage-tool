import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeScript } from '@/components/layout/theme-script';

import './globals.css';

export const metadata: Metadata = {
  title: 'Prototype Manage Tool',
  description: 'Front-end prototype publishing and preview tool',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
