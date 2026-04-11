import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const rootLayoutSource = readProjectSource('app/layout.tsx');
const workspaceShellSource = readProjectSource('components/layout/workspace-shell.tsx');
const authShellSource = readProjectSource('components/layout/auth-shell.tsx');
const userNavSource = readProjectSource('components/layout/user-nav.tsx');

describe('app frame layout migration', () => {
  test('uses AppFrame in root layout instead of legacy AppShell', () => {
    expect(rootLayoutSource).toContain("import { AppFrame } from '@/components/layout/app-frame';");
    expect(rootLayoutSource).toContain('<AppFrame>{children}</AppFrame>');
    expect(rootLayoutSource).not.toContain('AppShell');
  });

  test('mounts theme hydration script in root layout', () => {
    expect(rootLayoutSource).toContain("import { ThemeScript } from '@/components/layout/theme-script';");
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
    expect(workspaceShellSource).not.toContain('<LanguageSwitcher />');
    expect(workspaceShellSource).toContain('readLanguagePreference');
    expect(workspaceShellSource).toContain('resolvedNavigationLabel');
  });

  test('keeps auth shell and user nav aligned with auth/dashboard prototype', () => {
    expect(authShellSource).toContain('min-h-screen');
    expect(authShellSource).toContain('<LanguageSwitcher />');
    expect(userNavSource).toContain('Profile');
    expect(userNavSource).toContain("router.push('/settings')");
  });
});
