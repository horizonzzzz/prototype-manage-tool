import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_LANGUAGE_STORAGE_KEY, normalizeLanguagePreference } from '@/lib/ui/app-preferences';

const registerCopyMap = {
  en: {
    brandTitle: 'Prototype Management System',
    title: 'Create an account',
    description: 'Enter your details below to create your account',
    footerText: 'Already have an account?',
    footerActionLabel: 'Sign in',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    submitLabel: 'Register',
  },
  zh: {
    brandTitle: '原型管理系统',
    title: '创建账号',
    description: '请输入您的信息以创建账号',
    footerText: '已有账号？',
    footerActionLabel: '去登录',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    confirmPasswordLabel: '确认密码',
    submitLabel: '注册',
  },
} as const;

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const language = normalizeLanguagePreference(cookieStore.get(APP_LANGUAGE_STORAGE_KEY)?.value);
  const copy = registerCopyMap[language];

  async function enterWorkspace() {
    'use server';
    redirect('/admin');
  }

  return (
    <AuthCard
      brandTitle={copy.brandTitle}
      title={copy.title}
      description={copy.description}
      footerText={copy.footerText}
      footerActionLabel={copy.footerActionLabel}
      footerActionHref="/login"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">{copy.emailLabel}</Label>
          <Input id="register-email" type="email" placeholder="m@example.com" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">{copy.passwordLabel}</Label>
          <Input id="register-password" type="password" autoComplete="new-password" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">{copy.confirmPasswordLabel}</Label>
          <Input id="register-confirm-password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="w-full">
          {copy.submitLabel}
        </Button>
      </form>
    </AuthCard>
  );
}
