import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  getApiUserMock,
  updateUserProfileMock,
  changeUserPasswordMock,
  unstableUpdateMock,
} = vi.hoisted(() => ({
  getApiUserMock: vi.fn(),
  updateUserProfileMock: vi.fn(),
  changeUserPasswordMock: vi.fn(),
  unstableUpdateMock: vi.fn(),
}));

vi.mock('@/lib/server/api-auth', () => ({
  getApiUser: getApiUserMock,
}));

vi.mock('@/lib/server/user-settings-service', () => ({
  updateUserProfile: updateUserProfileMock,
  changeUserPassword: changeUserPasswordMock,
}));

vi.mock('@/auth', () => ({
  unstable_update: unstableUpdateMock,
}));

import { POST as POST_PROFILE } from '@/app/api/settings/profile/route';
import { POST as POST_PASSWORD } from '@/app/api/settings/password/route';

describe('/api/settings/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    });
  });

  test('updates the signed-in user profile and refreshes the session payload', async () => {
    updateUserProfileMock.mockResolvedValue({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/avatar-123.png',
    });

    const formData = new FormData();
    formData.set('name', 'Owner');
    formData.set('avatar', new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    const response = await POST_PROFILE(
      new Request('http://localhost/api/settings/profile', {
        method: 'POST',
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Owner',
      avatarFile: expect.any(File),
    });
    expect(unstableUpdateMock).toHaveBeenCalledWith({
      user: {
        name: 'Owner',
        email: 'owner@example.com',
        image: '/user-avatars/user-1/avatar-123.png',
      },
    });
  });
});

describe('/api/settings/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    });
  });

  test('changes the signed-in user password through the settings service', async () => {
    const response = await POST_PASSWORD(
      new Request('http://localhost/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'current-password',
          newPassword: 'new-password-123',
          confirmPassword: 'new-password-123',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(changeUserPasswordMock).toHaveBeenCalledWith({
      userId: 'user-1',
      currentPassword: 'current-password',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    });
  });
});
