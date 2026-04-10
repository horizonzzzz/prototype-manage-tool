import { cookies } from 'next/headers';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { APP_LANGUAGE_STORAGE_KEY, normalizeLanguagePreference } from '@/lib/ui/app-preferences';

const settingsCopyMap = {
  en: {
    title: 'Settings',
    description: 'Manage application settings and preferences.',
    languageTitle: 'Language',
    languageDescription: 'Select your preferred language for the interface.',
  },
  zh: {
    title: '设置',
    description: '管理应用程序设置和偏好。',
    languageTitle: '语言',
    languageDescription: '选择您喜欢的界面语言。',
  },
} as const;

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const language = normalizeLanguagePreference(cookieStore.get(APP_LANGUAGE_STORAGE_KEY)?.value);
  const copy = settingsCopyMap[language];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{copy.title}</h2>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-4 rounded-xl border p-6 bg-card">
          <div>
            <h3 className="text-lg font-medium">{copy.languageTitle}</h3>
            <p className="text-sm text-muted-foreground">{copy.languageDescription}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
