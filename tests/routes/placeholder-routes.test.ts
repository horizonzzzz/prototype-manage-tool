import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

describe('placeholder routes', () => {
  test('keeps auth and secondary pages only inside locale route groups', () => {
    expect(projectFileExists('app/[locale]/(auth)/login/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(auth)/register/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(workspace)/users/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(workspace)/settings/page.tsx')).toBe(true);
    expect(projectFileExists('app/login/page.tsx')).toBe(false);
    expect(projectFileExists('app/register/page.tsx')).toBe(false);
    expect(projectFileExists('app/users/page.tsx')).toBe(false);
    expect(projectFileExists('app/settings/page.tsx')).toBe(false);
  });

  test('renders users and settings pages through next-intl server translations', () => {
    const usersPageSource = readProjectSource('app/[locale]/(workspace)/users/page.tsx');
    const settingsPageSource = readProjectSource('app/[locale]/(workspace)/settings/page.tsx');

    expect(usersPageSource).toContain("from 'next-intl/server'");
    expect(usersPageSource).toContain('getTranslations');
    expect(usersPageSource).toContain('rounded-xl border border-dashed bg-card');
    expect(usersPageSource).not.toContain('CardTitle');
    expect(settingsPageSource).toContain("from 'next-intl/server'");
    expect(settingsPageSource).toContain('getTranslations');
    expect(settingsPageSource).toContain('rounded-xl border p-6 bg-card');
    expect(settingsPageSource).not.toContain('<Card');
    expect(settingsPageSource).not.toContain('FeaturePlaceholder');
  });

  test('auth placeholders stay server-driven and locale-aware', () => {
    const loginPageSource = readProjectSource('app/[locale]/(auth)/login/page.tsx');
    const registerPageSource = readProjectSource('app/[locale]/(auth)/register/page.tsx');

    expect(loginPageSource).toContain("'use server'");
    expect(loginPageSource).toContain("from '@/i18n/navigation'");
    expect(loginPageSource).toContain('<form action={enterWorkspace}');
    expect(loginPageSource).not.toContain('<form action="/admin"');
    expect(loginPageSource).toContain('type="submit"');
    expect(registerPageSource).toContain("'use server'");
    expect(registerPageSource).toContain("from '@/i18n/navigation'");
    expect(registerPageSource).toContain('<form action={enterWorkspace}');
    expect(registerPageSource).not.toContain('<form action="/admin"');
    expect(registerPageSource).toContain('type="submit"');
  });

  test('auth and secondary pages no longer depend on language preference cookies or local storage keys', () => {
    const loginPageSource = readProjectSource('app/[locale]/(auth)/login/page.tsx');
    const registerPageSource = readProjectSource('app/[locale]/(auth)/register/page.tsx');
    const settingsPageSource = readProjectSource('app/[locale]/(workspace)/settings/page.tsx');
    const usersPageSource = readProjectSource('app/[locale]/(workspace)/users/page.tsx');
    const languageSwitcherSource = readProjectSource('components/layout/language-switcher.tsx');

    expect(loginPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(registerPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(settingsPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(usersPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(languageSwitcherSource).toContain("from '@/i18n/navigation'");
    expect(languageSwitcherSource).not.toContain('document.cookie');
  });
});
