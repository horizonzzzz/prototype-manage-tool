import { getLocale } from 'next-intl/server';

import { AdminProductListPage } from '@/components/admin/pages/admin-product-list-page';
import { redirect } from '@/i18n/navigation';
import { isSafeRouteSegment } from '@/lib/domain/route-segment';
import { requirePageUser } from '@/lib/server/session-user';
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
  const locale = await getLocale();
  const user = await requirePageUser(locale);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const product = takeFirst(resolvedSearchParams?.product);

  if (product && isSafeRouteSegment(product)) {
    redirect({ href: buildAdminHref(product), locale });
  }

  const products = await prisma.product.findMany({
    where: { ownerId: user.id },
    include: { versions: true },
    orderBy: { createdAt: 'desc' },
  });

  return <AdminProductListPage initialProducts={products.map(serializeProductListItem)} />;
}
