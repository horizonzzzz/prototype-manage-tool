'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppLocale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();

  const onLanguageChange = (nextValue: string) => {
    const nextLocale = nextValue as AppLocale;
    router.replace(
      // @ts-expect-error Current route params are already bound to the active pathname.
      { pathname, params },
      { locale: nextLocale },
    );
  };

  return (
    <Select value={locale} onValueChange={onLanguageChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder={t('label')}>
          {locale === 'zh' ? t('zh') : t('en')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">{t('zh')}</SelectItem>
        <SelectItem value="en">{t('en')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
