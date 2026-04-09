import { redirect } from 'next/navigation';

import { AdminDashboard } from '@/components/admin-dashboard';
import { resolveAdminProductKey } from '@/lib/ui/navigation';
import { prisma } from '@/lib/prisma';

type AdminProductRouteProps = {
  params: Promise<{ productKey: string }>;
};

export default async function AdminProductPage({ params }: AdminProductRouteProps) {
  const { productKey } = await params;
  const products = await prisma.product.findMany({
    select: { key: true },
    orderBy: { createdAt: 'asc' },
  });

  const resolvedProductKey = resolveAdminProductKey(
    products.map((item) => item.key),
    productKey,
  );

  if (!resolvedProductKey) {
    redirect('/admin');
  }

  if (resolvedProductKey !== productKey) {
    redirect(`/admin/${resolvedProductKey}`);
  }

  return <AdminDashboard productKey={resolvedProductKey} />;
}
