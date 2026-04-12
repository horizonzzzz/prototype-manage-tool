import { getLocale, getTranslations } from 'next-intl/server';

import { requirePageUser } from '@/lib/server/session-user';

export default async function UsersPage() {
  const locale = await getLocale();
  await requirePageUser(locale);
  const t = await getTranslations('users');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed bg-card">
        <div className="text-center">
          <h3 className="text-lg font-medium">{t('emptyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      </div>
    </div>
  );
}
