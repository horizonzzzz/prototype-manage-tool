'use client';

import { Suspense } from 'react';

import { PreviewBrowser } from '@/components/preview-browser';

export default function PreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewBrowser />
    </Suspense>
  );
}
