import { getLocale, getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { redirect } from '@/i18n/navigation';

export default async function RegisterPage() {
  const t = await getTranslations('auth.register');

  async function enterWorkspace() {
    'use server';
    const locale = await getLocale();
    redirect({ href: '/admin', locale });
  }

  return (
    <AuthCard
      brandTitle={t('brandTitle')}
      title={t('title')}
      description={t('description')}
      footerText={t('footerText')}
      footerActionLabel={t('footerActionLabel')}
      footerActionHref="/login"
    >
      <form action={enterWorkspace} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">{t('emailLabel')}</Label>
          <Input id="register-email" type="email" placeholder="m@example.com" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">{t('passwordLabel')}</Label>
          <Input id="register-password" type="password" autoComplete="new-password" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">{t('confirmPasswordLabel')}</Label>
          <Input id="register-confirm-password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="w-full">
          {t('submitLabel')}
        </Button>
      </form>
    </AuthCard>
  );
}
