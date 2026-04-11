import { redirect } from 'next/navigation';

import { AdminProductListPage } from '@/components/admin/pages/admin-product-list-page';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { buildAdminHref } from '@/lib/ui/navigation';
import { prisma } from '@/lib/prisma';
import { serializeProductListItem } from '@/lib/server/serializers';

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const product = takeFirst(resolvedSearchParams?.product);

  if (product && isSafeRouteSegment(product)) {
    redirect(buildAdminHref(product));
  }

  const products = await prisma.product.findMany({
    include: { versions: true },
    orderBy: { createdAt: 'desc' },
  });

  return <AdminProductListPage initialProducts={products.map(serializeProductListItem)} />;
}
