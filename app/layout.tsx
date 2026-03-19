import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';

import './globals.css';

export const metadata: Metadata = {
  title: 'Prototype Preview Platform',
  description: 'Front-end prototype publishing and preview platform MVP',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}

