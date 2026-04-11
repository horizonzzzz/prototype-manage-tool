import { getLocale } from 'next-intl/server';

import { AdminDashboard } from '@/components/admin-dashboard';
import { redirect } from '@/i18n/navigation';
import { resolveAdminProductKey } from '@/lib/ui/navigation';
import { prisma } from '@/lib/prisma';

type AdminProductRouteProps = {
  params: Promise<{ productKey: string }>;
};

export default async function AdminProductPage({ params }: AdminProductRouteProps) {
  const locale = await getLocale();
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
    redirect({ href: '/admin', locale });
  }

  if (resolvedProductKey !== productKey) {
    redirect({ href: `/admin/${resolvedProductKey}`, locale });
  }

  return <AdminDashboard productKey={resolvedProductKey!} />;
}
