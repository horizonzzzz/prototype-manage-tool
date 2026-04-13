import { getLocale, getTranslations } from 'next-intl/server';

import { McpKeysSettings } from '@/components/settings/mcp-keys-settings';
import { prisma } from '@/lib/prisma';
import { listUserMcpApiKeys } from '@/lib/server/mcp-api-key-service';
import { requirePageUser } from '@/lib/server/session-user';

export default async function McpPage() {
  const locale = await getLocale();
  const user = await requirePageUser(locale);
  const t = await getTranslations('mcp');
  const [mcpKeys, products] = await Promise.all([
    listUserMcpApiKeys(user.id),
    prisma.product.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        key: true,
        name: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
  ]);

  return (
    <McpKeysSettings title={t('title')} description={t('description')} initialKeys={mcpKeys} availableProducts={products} />
  );
}
