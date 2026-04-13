import { describe, expect, test } from 'vitest';

import {
  resolveAvatarImageVisibility,
  resolveAvatarFallbackVisibility,
} from '@/components/ui/avatar';

describe('avatar primitive', () => {
  test('shows fallback when no image source is available', () => {
    expect(resolveAvatarImageVisibility(undefined, 'idle')).toBe(false);
    expect(resolveAvatarFallbackVisibility('idle')).toBe(true);
  });

  test('hides fallback after a valid image has loaded', () => {
    expect(resolveAvatarImageVisibility('/user-avatars/user-1/avatar.png', 'loaded')).toBe(true);
    expect(resolveAvatarFallbackVisibility('loaded')).toBe(false);
  });

  test('shows fallback again when image loading fails', () => {
    expect(resolveAvatarImageVisibility('/user-avatars/user-1/avatar.png', 'error')).toBe(false);
    expect(resolveAvatarFallbackVisibility('error')).toBe(true);
  });
});
