'use client';

import { App as AntApp } from 'antd';

import { AdminDashboard } from '@/components/admin-dashboard';

export default function AdminPage() {
  return (
    <AntApp>
      <AdminDashboard />
    </AntApp>
  );
}

