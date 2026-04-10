import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('placeholder routes', () => {
  test('adds login, register, users, and settings pages', () => {
    expect(existsSync(new URL('../app/login/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/register/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/users/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/settings/page.tsx', import.meta.url))).toBe(true);
  });

  test('renders prototype-aligned users and settings secondary pages', () => {
    const usersPageSource = readFileSync(new URL('../app/users/page.tsx', import.meta.url), 'utf8');
    const settingsPageSource = readFileSync(new URL('../app/settings/page.tsx', import.meta.url), 'utf8');

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
    const loginPageSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
    const registerPageSource = readFileSync(new URL('../app/register/page.tsx', import.meta.url), 'utf8');

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
    const loginPageSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
    const registerPageSource = readFileSync(new URL('../app/register/page.tsx', import.meta.url), 'utf8');
    const settingsPageSource = readFileSync(new URL('../app/settings/page.tsx', import.meta.url), 'utf8');
    const usersPageSource = readFileSync(new URL('../app/users/page.tsx', import.meta.url), 'utf8');
    const languageSwitcherSource = readFileSync(new URL('../components/layout/language-switcher.tsx', import.meta.url), 'utf8');

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
