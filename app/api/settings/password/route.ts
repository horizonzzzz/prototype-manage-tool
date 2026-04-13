import { z } from 'zod';

import { fail, ok } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { UserSettingsError, changeUserPassword } from '@/lib/server/user-settings-service';

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
  confirmPassword: z.string(),
});

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const parsed = passwordSchema.parse(await request.json());
    await changeUserPassword({
      userId: user.id,
      currentPassword: parsed.currentPassword,
      newPassword: parsed.newPassword,
      confirmPassword: parsed.confirmPassword,
    });

    return ok(null, 'Password updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail('password_payload_invalid', 400);
    }

    if (error instanceof UserSettingsError) {
      return fail(error.code, 400);
    }

    return fail('password_update_failed', 400);
  }
}
