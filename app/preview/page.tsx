'use client';

import { Suspense } from 'react';
import { App as AntApp } from 'antd';

import { PreviewBrowser } from '@/components/preview-browser';

export default function PreviewPage() {
  return (
    <AntApp>
      <Suspense fallback={null}>
        <PreviewBrowser />
      </Suspense>
    </AntApp>
  );
}
