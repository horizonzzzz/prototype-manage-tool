import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_LANGUAGE_STORAGE_KEY, normalizeLanguagePreference } from '@/lib/ui/app-preferences';

const loginCopyMap = {
  en: {
    brandTitle: 'Prototype Management System',
    title: 'Login',
    description: 'Enter your email below to login to your account',
    footerText: "Don't have an account?",
    footerActionLabel: 'Sign up',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submitLabel: 'Login',
  },
  zh: {
    brandTitle: '原型管理系统',
    title: '登录',
    description: '请输入您的邮箱以登录账号',
    footerText: '还没有账号？',
    footerActionLabel: '去注册',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    submitLabel: '登录',
  },
} as const;

export default async function LoginPage() {
  const cookieStore = await cookies();
  const language = normalizeLanguagePreference(cookieStore.get(APP_LANGUAGE_STORAGE_KEY)?.value);
  const copy = loginCopyMap[language];

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
      footerActionHref="/register"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{copy.emailLabel}</Label>
          <Input id="login-email" type="email" placeholder="m@example.com" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">{copy.passwordLabel}</Label>
          <Input id="login-password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">
          {copy.submitLabel}
        </Button>
      </form>
    </AuthCard>
  );
}
