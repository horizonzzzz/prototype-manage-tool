import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('placeholder routes', () => {
  test('adds login, register, users, and settings pages', () => {
    expect(existsSync(new URL('../app/login/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/register/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/users/page.tsx', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../app/settings/page.tsx', import.meta.url))).toBe(true);
  });

  test('renders reserved-feature copy for users and settings placeholders', () => {
    const usersPageSource = readFileSync(new URL('../app/users/page.tsx', import.meta.url), 'utf8');
    const settingsPageSource = readFileSync(new URL('../app/settings/page.tsx', import.meta.url), 'utf8');
    const featurePlaceholderSource = readFileSync(new URL('../components/placeholders/feature-placeholder.tsx', import.meta.url), 'utf8');

    expect(usersPageSource).toContain('预留功能');
    expect(usersPageSource).toContain('演示入口');
    expect(settingsPageSource).toContain('预留功能');
    expect(settingsPageSource).toContain('演示入口');
    expect(featurePlaceholderSource).toContain('disabled');
    expect(featurePlaceholderSource).toContain('返回工作台');
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
});
