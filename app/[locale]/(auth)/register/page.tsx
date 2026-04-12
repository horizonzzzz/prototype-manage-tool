import { AuthError } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerUser } from '@/lib/server/auth-service';
import { buildLocalizedHref, redirectAuthenticatedUser } from '@/lib/server/session-user';

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function takeFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveErrorMessage(errorCode: string | undefined, t: Awaited<ReturnType<typeof getTranslations>>) {
  switch (errorCode) {
    case 'invalid_input':
      return t('invalidInput');
    case 'email_exists':
      return t('emailExists');
    case 'password_mismatch':
      return t('passwordMismatch');
    default:
      return errorCode ? t('genericError') : null;
  }
}

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { locale } = await params;
  await redirectAuthenticatedUser(locale);

  const t = await getTranslations('auth.register');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolveErrorMessage(takeFirst(resolvedSearchParams?.error), t);

  async function register(formData: FormData) {
    'use server';

    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    try {
      await registerUser({
        email,
        password,
        confirmPassword,
      });

      await signIn('credentials', {
        email,
        password,
        redirectTo: buildLocalizedHref(locale, '/admin'),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(buildLocalizedHref(locale, '/register?error=generic'));
      }

      if (error instanceof Error) {
        if (error.message === 'INVALID_REGISTRATION_INPUT') {
          redirect(buildLocalizedHref(locale, '/register?error=invalid_input'));
        }

        if (error.message === 'EMAIL_ALREADY_EXISTS') {
          redirect(buildLocalizedHref(locale, '/register?error=email_exists'));
        }

        if (error.message === 'PASSWORD_MISMATCH') {
          redirect(buildLocalizedHref(locale, '/register?error=password_mismatch'));
        }
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
      footerActionHref="/login"
    >
      <form action={register} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="register-email">{t('emailLabel')}</Label>
          <Input
            id="register-email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-password">{t('passwordLabel')}</Label>
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="register-confirm-password">{t('confirmPasswordLabel')}</Label>
          <Input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" className="w-full">
          {t('submitLabel')}
        </Button>
      </form>
    </AuthCard>
  );
}
