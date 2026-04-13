import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const rootLayoutSource = readProjectSource('app/layout.tsx');
const localeLayoutSource = readProjectSource('app/[locale]/layout.tsx');
const workspaceShellSource = readProjectSource('components/layout/workspace-shell.tsx');
const authShellSource = readProjectSource('components/layout/auth-shell.tsx');
const userNavSource = readProjectSource('components/layout/user-nav.tsx');
const navigationSource = readProjectSource('lib/ui/navigation.ts');

describe('app frame layout migration', () => {
  test('keeps the root layout locale-agnostic so client locale switches can remount the localized shell', () => {
    expect(rootLayoutSource).not.toContain("import { AppFrame } from '@/components/layout/app-frame';");
    expect(rootLayoutSource).not.toContain('NextIntlClientProvider');
    expect(rootLayoutSource).not.toContain('getLocale');
    expect(rootLayoutSource).not.toContain('getMessages');
  });

  test('binds next-intl request state and the app frame to the locale layout', () => {
    expect(projectFileExists('i18n/routing.ts')).toBe(true);
    expect(projectFileExists('i18n/request.ts')).toBe(true);
    expect(projectFileExists('proxy.ts')).toBe(true);
    expect(projectFileExists('messages/zh.json')).toBe(true);
    expect(projectFileExists('messages/en.json')).toBe(true);
    expect(localeLayoutSource).toContain('setRequestLocale');
    expect(localeLayoutSource).toContain('NextIntlClientProvider');
    expect(localeLayoutSource).toContain("import { AppFrame } from '@/components/layout/app-frame';");
    expect(localeLayoutSource).toContain('<AppFrame>{children}</AppFrame>');
    expect(rootLayoutSource).toContain('<ThemeScript />');
  });

  test('adds app frame shell boundaries for auth and workspace surfaces', () => {
    expect(projectFileExists('components/layout/app-frame.tsx')).toBe(true);
    expect(projectFileExists('components/layout/workspace-shell.tsx')).toBe(true);
    expect(projectFileExists('components/layout/auth-shell.tsx')).toBe(true);
  });

  test('keeps workspace shell composition aligned with dashboard prototype', () => {
    expect(workspaceShellSource).toContain('<aside className="hidden w-64 flex-col border-r bg-card md:flex">');
    expect(workspaceShellSource).toContain('Admin Pro');
    expect(workspaceShellSource).toContain('<ThemeToggle />');
    expect(workspaceShellSource).toContain('<UserNav />');
    expect(workspaceShellSource).not.toContain('readLanguagePreference');
    expect(workspaceShellSource).toContain('useTranslations');
    expect(navigationSource).toContain("href: '/mcp'");
  });

  test('keeps auth shell and user nav aligned with auth/dashboard prototype', () => {
    expect(authShellSource).toContain('min-h-screen');
    expect(authShellSource).toContain('<LanguageSwitcher />');
    expect(userNavSource).toContain("useTranslations('userNav')");
    expect(userNavSource).toContain("from '@/i18n/navigation'");
  });
});
