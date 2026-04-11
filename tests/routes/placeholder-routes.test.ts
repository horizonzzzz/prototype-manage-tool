import { projectFileExists, readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

describe('placeholder routes', () => {
  test('adds login, register, users, and settings pages', () => {
    expect(projectFileExists('app/login/page.tsx')).toBe(true);
    expect(projectFileExists('app/register/page.tsx')).toBe(true);
    expect(projectFileExists('app/users/page.tsx')).toBe(true);
    expect(projectFileExists('app/settings/page.tsx')).toBe(true);
  });

  test('renders prototype-aligned users and settings secondary pages', () => {
    const usersPageSource = readProjectSource('app/users/page.tsx');
    const settingsPageSource = readProjectSource('app/settings/page.tsx');

    expect(usersPageSource).toContain('User Management');
    expect(usersPageSource).toContain('Manage user accounts and permissions.');
    expect(usersPageSource).toContain('Coming Soon');
    expect(usersPageSource).toContain('User management features will be available here.');
    expect(usersPageSource).not.toContain('即将推出');
    expect(usersPageSource).toContain('rounded-xl border border-dashed bg-card');
    expect(usersPageSource).not.toContain('CardTitle');
    expect(settingsPageSource).toContain('Settings');
    expect(settingsPageSource).toContain('Manage application settings and preferences.');
    expect(settingsPageSource).toContain('Language');
    expect(settingsPageSource).toContain('Select your preferred language for the interface.');
    expect(settingsPageSource).toContain('rounded-xl border p-6 bg-card');
    expect(settingsPageSource).not.toContain('<Card');
    expect(settingsPageSource).not.toContain('FeaturePlaceholder');
  });

  test('auth placeholders submit forms into workspace demo route', () => {
    const loginPageSource = readProjectSource('app/login/page.tsx');
    const registerPageSource = readProjectSource('app/register/page.tsx');

    expect(loginPageSource).toContain("'use server'");
    expect(loginPageSource).toContain("redirect('/admin')");
    expect(loginPageSource).toContain('<form action={enterWorkspace}');
    expect(loginPageSource).not.toContain('<form action="/admin"');
    expect(loginPageSource).toContain('type="submit"');
    expect(registerPageSource).toContain("'use server'");
    expect(registerPageSource).toContain("redirect('/admin')");
    expect(registerPageSource).toContain('<form action={enterWorkspace}');
    expect(registerPageSource).not.toContain('<form action="/admin"');
    expect(registerPageSource).toContain('type="submit"');
  });

  test('auth and secondary pages read the language preference from cookies so copy can switch with the language toggle', () => {
    const loginPageSource = readProjectSource('app/login/page.tsx');
    const registerPageSource = readProjectSource('app/register/page.tsx');
    const settingsPageSource = readProjectSource('app/settings/page.tsx');
    const usersPageSource = readProjectSource('app/users/page.tsx');
    const languageSwitcherSource = readProjectSource('components/layout/language-switcher.tsx');

    expect(loginPageSource).toContain("from 'next/headers'");
    expect(registerPageSource).toContain("from 'next/headers'");
    expect(settingsPageSource).toContain("from 'next/headers'");
    expect(usersPageSource).toContain("from 'next/headers'");
    expect(loginPageSource).toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(registerPageSource).toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(settingsPageSource).toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(usersPageSource).toContain('APP_LANGUAGE_STORAGE_KEY');
    expect(languageSwitcherSource).toContain('document.cookie');
    expect(languageSwitcherSource).toContain('APP_LANGUAGE_STORAGE_KEY');
  });
});
