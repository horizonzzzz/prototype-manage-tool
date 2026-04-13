import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { appConfig } from '@/lib/config';
import { ensureChildPath } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/server/password';

const AVATAR_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

type SupportedAvatarType = keyof typeof AVATAR_TYPES;

export const USER_SETTINGS_ERROR_CODES = {
  displayNameRequired: 'display_name_required',
  unsupportedAvatarFileType: 'unsupported_avatar_file_type',
  avatarFileTooLarge: 'avatar_file_too_large',
  userNotFound: 'user_not_found',
  currentPasswordIncorrect: 'current_password_incorrect',
  passwordTooShort: 'password_too_short',
  passwordConfirmationMismatch: 'password_confirmation_mismatch',
} as const;

export type UserSettingsErrorCode = (typeof USER_SETTINGS_ERROR_CODES)[keyof typeof USER_SETTINGS_ERROR_CODES];

export class UserSettingsError extends Error {
  readonly code: UserSettingsErrorCode;

  constructor(code: UserSettingsErrorCode) {
    super(code);
    this.name = 'UserSettingsError';
    this.code = code;
  }
}

export type UserSettingsProfile = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type UpdateUserProfileInput = {
  userId: string;
  name: string;
  avatarFile?: File | null;
};

type ChangeUserPasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function normalizeDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.displayNameRequired);
  }

  return trimmed;
}

function resolveAvatarExtension(type: string) {
  const extension = AVATAR_TYPES[type as SupportedAvatarType];
  if (!extension) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.unsupportedAvatarFileType);
  }

  return extension;
}

function resolveStoredAvatarPath(userId: string, fileName: string) {
  return ensureChildPath(appConfig.userAvatarsDir, userId, fileName);
}

function buildAvatarUrl(userId: string, fileName: string) {
  return `/user-avatars/${userId}/${fileName}`;
}

async function removePreviousAvatar(userId: string, imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith(`/user-avatars/${userId}/`)) {
    return;
  }

  const fileName = imageUrl.split('/').pop();
  if (!fileName) {
    return;
  }

  await fs.rm(resolveStoredAvatarPath(userId, fileName), { force: true });
}

async function storeAvatar(userId: string, avatarFile: File) {
  const extension = resolveAvatarExtension(avatarFile.type);

  if (avatarFile.size > appConfig.avatarMaxBytes) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.avatarFileTooLarge);
  }

  const fileName = `${randomUUID()}.${extension}`;
  const avatarDir = ensureChildPath(appConfig.userAvatarsDir, userId);
  const targetPath = resolveStoredAvatarPath(userId, fileName);

  await fs.mkdir(avatarDir, { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(await avatarFile.arrayBuffer()));

  return {
    path: targetPath,
    url: buildAvatarUrl(userId, fileName),
  };
}

export async function getUserSettings(userId: string): Promise<UserSettingsProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.userNotFound);
  }

  return {
    id: user.id,
    name: user.name?.trim() || user.email,
    email: user.email,
    image: user.image,
  };
}

export async function updateUserProfile({ userId, name, avatarFile }: UpdateUserProfileInput): Promise<UserSettingsProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.userNotFound);
  }

  const normalizedName = normalizeDisplayName(name);
  let image = user.image;
  let stagedAvatar:
    | {
        path: string;
        url: string;
      }
    | null = null;

  if (avatarFile && avatarFile.size > 0) {
    stagedAvatar = await storeAvatar(userId, avatarFile);
    image = stagedAvatar.url;
  }

  let updatedUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: normalizedName,
        image,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });
  } catch (error) {
    if (stagedAvatar) {
      try {
        await fs.rm(stagedAvatar.path, { force: true });
      } catch {}
    }

    throw error;
  }

  if (stagedAvatar) {
    await removePreviousAvatar(userId, user.image).catch(() => undefined);
  }

  return {
    id: updatedUser.id,
    name: updatedUser.name?.trim() || updatedUser.email,
    email: updatedUser.email,
    image: updatedUser.image,
  };
}

export async function changeUserPassword({
  userId,
  currentPassword,
  newPassword,
  confirmPassword,
}: ChangeUserPasswordInput) {
  if (newPassword.length < 8) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.passwordTooShort);
  }

  if (newPassword !== confirmPassword) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.passwordConfirmationMismatch);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.userNotFound);
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new UserSettingsError(USER_SETTINGS_ERROR_CODES.currentPasswordIncorrect);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashPassword(newPassword),
    },
  });
}

export function resolveAvatarFilePath(userId: string, fileName: string) {
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error('Invalid avatar file path');
  }

  return resolveStoredAvatarPath(userId, fileName);
}

export function resolveAvatarContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}
