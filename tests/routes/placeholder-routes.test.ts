import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

describe('placeholder routes', () => {
  test('keeps auth and secondary pages only inside locale route groups', () => {
    expect(projectFileExists('app/[locale]/(auth)/login/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(auth)/register/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(workspace)/mcp/page.tsx')).toBe(true);
    expect(projectFileExists('app/[locale]/(workspace)/settings/page.tsx')).toBe(true);
    expect(projectFileExists('app/login/page.tsx')).toBe(false);
    expect(projectFileExists('app/mcp/page.tsx')).toBe(false);
    expect(projectFileExists('app/register/page.tsx')).toBe(false);
    expect(projectFileExists('app/users/page.tsx')).toBe(false);
    expect(projectFileExists('app/settings/page.tsx')).toBe(false);
  });

  test('renders mcp and settings pages through next-intl server translations', () => {
    const mcpPageSource = readProjectSource('app/[locale]/(workspace)/mcp/page.tsx');
    const settingsPageSource = readProjectSource('app/[locale]/(workspace)/settings/page.tsx');

    expect(mcpPageSource).toContain("from 'next-intl/server'");
    expect(mcpPageSource).toContain('getTranslations');
    expect(mcpPageSource).toContain('McpKeysSettings');
    expect(settingsPageSource).toContain("from 'next-intl/server'");
    expect(settingsPageSource).toContain('getTranslations');
    expect(settingsPageSource).not.toContain('McpKeysSettings');
    expect(settingsPageSource).toContain('ProfileSettings');
  });

  test('auth pages use real auth actions instead of placeholder workspace redirects', () => {
    const loginPageSource = readProjectSource('app/[locale]/(auth)/login/page.tsx');
    const registerPageSource = readProjectSource('app/[locale]/(auth)/register/page.tsx');

    expect(loginPageSource).toContain("'use server'");
    expect(loginPageSource).toContain("from '@/auth'");
    expect(loginPageSource).toContain('await signIn(');
    expect(loginPageSource).toContain('name="email"');
    expect(loginPageSource).toContain('name="password"');
    expect(loginPageSource).not.toContain('redirect({ href: \'/admin\'');
    expect(loginPageSource).toContain('type="submit"');
    expect(registerPageSource).toContain("'use server'");
    expect(registerPageSource).toContain("from '@/lib/server/auth-service'");
    expect(registerPageSource).toContain('await registerUser(');
    expect(registerPageSource).toContain('name="email"');
    expect(registerPageSource).toContain('name="password"');
    expect(registerPageSource).toContain('name="confirmPassword"');
    expect(registerPageSource).not.toContain('redirect({ href: \'/admin\'');
    expect(registerPageSource).toContain('type="submit"');
  });

  test('auth and secondary pages no longer depend on language preference cookies or local storage keys', () => {
    const loginPageSource = readProjectSource('app/[locale]/(auth)/login/page.tsx');
    const registerPageSource = readProjectSource('app/[locale]/(auth)/register/page.tsx');
    const settingsPageSource = readProjectSource('app/[locale]/(workspace)/settings/page.tsx');
    const languageSwitcherSource = readProjectSource('components/layout/language-switcher.tsx');

    expect(loginPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(registerPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(settingsPageSource).not.toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(languageSwitcherSource).toContain("from '@/i18n/navigation'");
    expect(languageSwitcherSource).not.toContain('document.cookie');
  });

  test('mcp management lives on its own page and uses common cancel translations', () => {
    const mcpPageSource = readProjectSource('app/[locale]/(workspace)/mcp/page.tsx');
    const settingsPageSource = readProjectSource('app/[locale]/(workspace)/settings/page.tsx');
    const settingsComponentSource = readProjectSource('components/settings/mcp-keys-settings.tsx');

    expect(mcpPageSource).toContain('<McpKeysSettings');
    expect(mcpPageSource).toContain("t('title')");
    expect(mcpPageSource).toContain("t('description')");
    expect(mcpPageSource).toContain('title={t(\'title\')}');
    expect(mcpPageSource).toContain('description={t(\'description\')}');
    expect(settingsPageSource).not.toContain('<McpKeysSettings');
    expect(settingsComponentSource).toContain("useTranslations('mcp')");
    expect(settingsComponentSource).toContain("useTranslations('common')");
    expect(settingsComponentSource).toContain('title: string');
    expect(settingsComponentSource).toContain('description: string');
    expect(settingsComponentSource).toContain('md:flex-row md:items-center md:justify-between');
    expect(settingsComponentSource).not.toContain('rounded-xl border p-6 bg-card');
    expect(settingsComponentSource).not.toContain('mcpTitle');
    expect(settingsComponentSource).not.toContain('mcpDescription');
    expect(settingsComponentSource).not.toContain("t('cancel')");
    expect(settingsComponentSource).toContain("tCommon('cancel')");
  });
});
