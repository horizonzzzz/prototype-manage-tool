import { getLocale, getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from '@/i18n/navigation';

export default async function LoginPage() {
  const t = await getTranslations('auth.login');

  async function enterWorkspace() {
    'use server';
    const nextLocale = await getLocale();
    redirect({ href: '/admin', locale: nextLocale });
  }

  return (
    <AuthCard
      brandTitle={t('brandTitle')}
      title={t('title')}
      description={t('description')}
      footerText={t('footerText')}
      footerActionLabel={t('footerActionLabel')}
      footerActionHref="/register"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{t('emailLabel')}</Label>
          <Input id="login-email" type="email" placeholder="m@example.com" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">{t('passwordLabel')}</Label>
          <Input id="login-password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">
          {t('submitLabel')}
        </Button>
      </form>
    </AuthCard>
  );
}
