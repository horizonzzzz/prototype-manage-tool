import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { UserSettingsError, updateUserProfile } from '@/lib/server/user-settings-service';
import { unstable_update } from '@/auth';

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const formData = await request.formData();
    const name = String(formData.get('name') ?? '');
    const avatarValue = formData.get('avatar');
    const avatarFile = avatarValue instanceof File && avatarValue.size > 0 ? avatarValue : null;

    const profile = await updateUserProfile({
      userId: user.id,
      name,
      avatarFile,
    });

    await unstable_update({
      user: {
        name: profile.name,
        email: profile.email,
        image: profile.image,
      },
    });

    return ok(profile, 'Profile updated');
  } catch (error) {
    if (error instanceof UserSettingsError) {
      return fail(error.code, 400);
    }

    return fail('profile_update_failed', 400);
  }
}
