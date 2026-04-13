import { describe, expect, test } from 'vitest';

import { resolveSettingsErrorTranslationKey } from '@/lib/ui/settings-errors';

describe('settings error translation mapping', () => {
  test('maps stable settings error codes to translation keys', () => {
    expect(resolveSettingsErrorTranslationKey('display_name_required')).toBe('errors.displayNameRequired');
    expect(resolveSettingsErrorTranslationKey('unsupported_avatar_file_type')).toBe('errors.unsupportedAvatarType');
    expect(resolveSettingsErrorTranslationKey('current_password_incorrect')).toBe('errors.currentPasswordIncorrect');
  });

  test('returns null for unknown error codes', () => {
    expect(resolveSettingsErrorTranslationKey('database unavailable')).toBeNull();
    expect(resolveSettingsErrorTranslationKey(undefined)).toBeNull();
  });
});
