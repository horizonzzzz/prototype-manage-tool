import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default async function SettingsPage() {
  const t = await getTranslations('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-4 rounded-xl border p-6 bg-card">
          <div>
            <h3 className="text-lg font-medium">{t('languageTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('languageDescription')}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
