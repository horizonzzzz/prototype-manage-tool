export const SETTINGS_ERROR_TRANSLATION_KEYS = {
  display_name_required: 'errors.displayNameRequired',
  unsupported_avatar_file_type: 'errors.unsupportedAvatarType',
  avatar_file_too_large: 'errors.avatarTooLarge',
  user_not_found: 'errors.userNotFound',
  current_password_incorrect: 'errors.currentPasswordIncorrect',
  password_too_short: 'errors.passwordTooShort',
  password_confirmation_mismatch: 'errors.passwordConfirmationMismatch',
} as const;

export function resolveSettingsErrorTranslationKey(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return SETTINGS_ERROR_TRANSLATION_KEYS[code as keyof typeof SETTINGS_ERROR_TRANSLATION_KEYS] ?? null;
}
