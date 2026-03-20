'use client';

import { Suspense } from 'react';
import { App as AntApp } from 'antd';

import { AdminDashboard } from '@/components/admin-dashboard';

export default function AdminPage() {
  return (
    <AntApp>
      <Suspense fallback={null}>
        <AdminDashboard />
      </Suspense>
    </AntApp>
  );
}
