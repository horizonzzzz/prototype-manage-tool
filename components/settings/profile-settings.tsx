'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchJson } from '@/lib/ui/api-client';
import { resolveSettingsErrorTranslationKey } from '@/lib/ui/settings-errors';

type UserSettingsProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type ProfileSettingsProps = {
  title: string;
  description: string;
  initialProfile: UserSettingsProfile;
};

function buildAvatarFallback(name: string, email: string) {
  const source = name.trim() || email.trim() || 'U';
  return source.slice(0, 2).toUpperCase();
}

export function ProfileSettings({ title, description, initialProfile }: ProfileSettingsProps) {
  const t = useTranslations('settings');
  const { update } = useSession();
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.name);
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(initialProfile.image);
  const [profilePending, setProfilePending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!selectedAvatar) {
      setAvatarPreviewUrl(profile.image);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatar);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatar, profile.image]);

  function resolveErrorMessage(message: string | undefined, fallbackKey: 'profileSaveError' | 'passwordSaveError') {
    const translationKey = resolveSettingsErrorTranslationKey(message);
    return translationKey ? t(translationKey as never) : t(fallbackKey);
  }

  async function submitProfile() {
    try {
      setProfilePending(true);
      const formData = new FormData();
      formData.set('name', name);
      if (selectedAvatar) {
        formData.set('avatar', selectedAvatar);
      }

      const savedProfile = await fetchJson<UserSettingsProfile>('/api/settings/profile', {
        method: 'POST',
        body: formData,
      });

      setProfile(savedProfile);
      setName(savedProfile.name);
      setSelectedAvatar(null);
      await update({
        user: {
          name: savedProfile.name,
          email: savedProfile.email,
          image: savedProfile.image,
        },
      });
      toast.success(t('profileSaved'));
    } catch (error) {
      toast.error(resolveErrorMessage(error instanceof Error ? error.message : undefined, 'profileSaveError'));
    } finally {
      setProfilePending(false);
    }
  }

  async function submitPassword() {
    try {
      setPasswordPending(true);
      await fetchJson<null>('/api/settings/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('passwordSaved'));
    } catch (error) {
      toast.error(resolveErrorMessage(error instanceof Error ? error.message : undefined, 'passwordSaveError'));
    } finally {
      setPasswordPending(false);
    }
  }

  const avatarFallback = buildAvatarFallback(name, profile.email);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-6">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div>
            <h3 className="text-lg font-medium">{t('profileTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('profileDescription')}</p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreviewUrl ?? undefined} alt={name} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="grid gap-2">
              <Label htmlFor="settings-avatar">{t('avatarLabel')}</Label>
              <Input
                id="settings-avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setSelectedAvatar(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="settings-name">{t('displayNameLabel')}</Label>
              <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-email">{t('emailLabel')}</Label>
              <Input id="settings-email" value={profile.email} readOnly disabled />
            </div>
          </div>
          <div>
            <Button type="button" onClick={() => void submitProfile()} disabled={profilePending}>
              {profilePending ? t('profileSaving') : t('profileSave')}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div>
            <h3 className="text-lg font-medium">{t('securityTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('securityDescription')}</p>
          </div>
          <div className="grid gap-4 md:max-w-xl">
            <div className="grid gap-2">
              <Label htmlFor="settings-current-password">{t('currentPasswordLabel')}</Label>
              <Input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-new-password">{t('newPasswordLabel')}</Label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-confirm-password">{t('confirmPasswordLabel')}</Label>
              <Input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Button type="button" onClick={() => void submitPassword()} disabled={passwordPending}>
              {passwordPending ? t('passwordSaving') : t('passwordSave')}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div>
            <h3 className="text-lg font-medium">{t('languageTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('languageDescription')}</p>
          </div>
          <LanguageSwitcher />
        </section>
      </div>
    </div>
  );
}
