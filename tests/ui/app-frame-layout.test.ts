import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const rootLayoutSource = readProjectSource('app/layout.tsx');
const localeLayoutSource = readProjectSource('app/[locale]/layout.tsx');
const workspaceShellSource = readProjectSource('components/layout/workspace-shell.tsx');
const authShellSource = readProjectSource('components/layout/auth-shell.tsx');
const userNavSource = readProjectSource('components/layout/user-nav.tsx');

describe('app frame layout migration', () => {
  test('keeps app frame composition in the root layout while adding next-intl locale handling', () => {
    expect(rootLayoutSource).toContain("import { AppFrame } from '@/components/layout/app-frame';");
    expect(rootLayoutSource).toContain('<AppFrame>{children}</AppFrame>');
    expect(rootLayoutSource).toContain('NextIntlClientProvider');
  });

  test('adds next-intl routing infrastructure and locale request handling', () => {
    expect(projectFileExists('i18n/routing.ts')).toBe(true);
    expect(projectFileExists('i18n/request.ts')).toBe(true);
    expect(projectFileExists('middleware.ts')).toBe(true);
    expect(projectFileExists('messages/zh.json')).toBe(true);
    expect(projectFileExists('messages/en.json')).toBe(true);
    expect(localeLayoutSource).toContain('setRequestLocale');
    expect(rootLayoutSource).toContain('getLocale');
    expect(rootLayoutSource).toContain('getMessages');
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
  });

  test('keeps auth shell and user nav aligned with auth/dashboard prototype', () => {
    expect(authShellSource).toContain('min-h-screen');
    expect(authShellSource).toContain('<LanguageSwitcher />');
    expect(userNavSource).toContain("useTranslations('userNav')");
    expect(userNavSource).toContain("from '@/i18n/navigation'");
  });
});
