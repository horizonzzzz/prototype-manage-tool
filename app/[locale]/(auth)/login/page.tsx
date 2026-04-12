import { AuthError } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildLocalizedHref, redirectAuthenticatedUser } from '@/lib/server/session-user';

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveErrorMessage(errorCode: string | undefined, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (errorCode === 'invalid_credentials') {
    return t('invalidCredentials');
  }

  return errorCode ? t('genericError') : null;
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  await redirectAuthenticatedUser(locale);

  const t = await getTranslations('auth.login');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolveErrorMessage(takeFirst(resolvedSearchParams?.error), t);

  async function login(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      await signIn('credentials', {
        email,
        password,
        redirectTo: buildLocalizedHref(locale, '/admin'),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(buildLocalizedHref(locale, '/login?error=invalid_credentials'));
      }

      throw error;
    }
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
      <form action={login} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{t('emailLabel')}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">{t('passwordLabel')}</Label>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" className="w-full">
          {t('submitLabel')}
        </Button>
      </form>
    </AuthCard>
  );
}
