'use client';

import { useEffect, useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  APP_LANGUAGE_STORAGE_KEY,
  getBrowserStorage,
  type AppLanguage,
  normalizeLanguagePreference,
  readLanguagePreference,
  writeLanguagePreference,
} from '@/lib/ui/app-preferences';

const languageLabelMap: Record<AppLanguage, string> = {
  zh: '中文',
  en: 'English',
};

function applyLanguageToDocument(language: AppLanguage) {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
}

export function LanguageSwitcher() {
  const [language, setLanguage] = useState<AppLanguage>('zh');

  useEffect(() => {
    const storedLanguage = readLanguagePreference(getBrowserStorage());
    setLanguage(storedLanguage);
    applyLanguageToDocument(storedLanguage);
  }, []);

  const onLanguageChange = (nextValue: string) => {
    const nextLanguage = normalizeLanguagePreference(nextValue);
    setLanguage(nextLanguage);
    writeLanguagePreference(getBrowserStorage(), nextLanguage);
    if (typeof document !== 'undefined') {
      document.cookie = `${APP_LANGUAGE_STORAGE_KEY}=${nextLanguage}; path=/; max-age=31536000`;
    }
    applyLanguageToDocument(nextLanguage);
  };

  return (
    <Select value={language} onValueChange={onLanguageChange}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Language">{languageLabelMap[language]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">
          {languageLabelMap.zh}
        </SelectItem>
        <SelectItem value="en">
          {languageLabelMap.en}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
