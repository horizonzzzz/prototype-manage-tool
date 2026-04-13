import path from 'node:path';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  userFindUniqueMock,
  userUpdateMock,
  mkdirMock,
  writeFileMock,
  unlinkMock,
  rmMock,
  randomUUIDMock,
} = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  rmMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
      update: userUpdateMock,
    },
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    unlink: unlinkMock,
    rm: rmMock,
  },
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  unlink: unlinkMock,
  rm: rmMock,
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');

  return {
    ...actual,
    randomUUID: randomUUIDMock,
  };
});

import { changeUserPassword, updateUserProfile } from '@/lib/server/user-settings-service';

describe('user settings service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDMock.mockReturnValue('avatar-123');
  });

  test('updates the user display name and avatar url, then removes the prior avatar after persistence', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      name: 'Before',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/old-avatar.png',
      passwordHash: 'stored-password-hash',
    });
    userUpdateMock.mockResolvedValue({
      id: 'user-1',
      name: 'After',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/avatar-123.png',
    });

    const profile = await updateUserProfile({
      userId: 'user-1',
      name: '  After  ',
      avatarFile: new File([Uint8Array.from([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' }),
    });

    expect(profile).toMatchObject({
      name: 'After',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/avatar-123.png',
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'After',
        image: '/user-avatars/user-1/avatar-123.png',
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });
    expect(userUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(rmMock.mock.invocationCallOrder[0]);
    expect(String(rmMock.mock.calls[0][0])).toContain(path.join('user-1', 'old-avatar.png'));
  });

  test('rejects avatar uploads that are not supported image types', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      name: 'Before',
      email: 'owner@example.com',
      image: null,
      passwordHash: 'stored-password-hash',
    });

    await expect(
      updateUserProfile({
        userId: 'user-1',
        name: 'After',
        avatarFile: new File(['avatar'], 'avatar.svg', { type: 'image/svg+xml' }),
      }),
    ).rejects.toThrow('unsupported_avatar_file_type');

    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  test('fails before any avatar file mutation when the display name is empty', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      name: 'Before',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/old-avatar.png',
      passwordHash: 'stored-password-hash',
    });

    await expect(
      updateUserProfile({
        userId: 'user-1',
        name: '   ',
        avatarFile: new File([Uint8Array.from([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' }),
      }),
    ).rejects.toThrow('display_name_required');

    expect(writeFileMock).not.toHaveBeenCalled();
    expect(rmMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  test('cleans up the newly written avatar when persistence fails', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      name: 'Before',
      email: 'owner@example.com',
      image: '/user-avatars/user-1/old-avatar.png',
      passwordHash: 'stored-password-hash',
    });
    userUpdateMock.mockRejectedValue(new Error('database unavailable'));

    await expect(
      updateUserProfile({
        userId: 'user-1',
        name: 'After',
        avatarFile: new File([Uint8Array.from([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' }),
      }),
    ).rejects.toThrow('database unavailable');

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(rmMock).toHaveBeenCalledTimes(1);
    expect(String(rmMock.mock.calls[0][0])).toContain(path.join('user-1', 'avatar-123.png'));
    expect(String(rmMock.mock.calls[0][0])).not.toContain('old-avatar.png');
  });

  test('requires the current password before changing it', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      passwordHash: 'stored-password-hash',
    });

    await expect(
      changeUserPassword({
        userId: 'user-1',
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      }),
    ).rejects.toThrow('current_password_incorrect');

    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
