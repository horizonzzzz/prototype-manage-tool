import { getLocale, getTranslations } from 'next-intl/server';

import { ProfileSettings } from '@/components/settings/profile-settings';
import { getUserSettings } from '@/lib/server/user-settings-service';
import { requirePageUser } from '@/lib/server/session-user';

export default async function SettingsPage() {
  const locale = await getLocale();
  const user = await requirePageUser(locale);
  const t = await getTranslations('settings');
  const profile = await getUserSettings(user.id);

  return (
    <ProfileSettings
      title={t('title')}
      description={t('description')}
      initialProfile={profile}
    />
  );
}
