import { cookies } from 'next/headers';

import { APP_LANGUAGE_STORAGE_KEY, normalizeLanguagePreference } from '@/lib/ui/app-preferences';

const usersCopyMap = {
  en: {
    title: 'User Management',
    description: 'Manage user accounts and permissions.',
    emptyTitle: 'Coming Soon',
    emptyDescription: 'User management features will be available here.',
  },
  zh: {
    title: '用户管理',
    description: '管理用户账户和权限。',
    emptyTitle: '敬请期待',
    emptyDescription: '用户管理功能将在此提供。',
  },
} as const;

export default async function UsersPage() {
  const cookieStore = await cookies();
  const language = normalizeLanguagePreference(cookieStore.get(APP_LANGUAGE_STORAGE_KEY)?.value);
  const copy = usersCopyMap[language];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{copy.title}</h2>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed bg-card">
        <div className="text-center">
          <h3 className="text-lg font-medium">{copy.emptyTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
        </div>
      </div>
    </div>
  );
}
