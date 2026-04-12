import { beforeEach, describe, expect, test, vi } from 'vitest';

const { userCreateMock, userFindUniqueMock } = vi.hoisted(() => ({
  userCreateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: userCreateMock,
      findUnique: userFindUniqueMock,
    },
  },
}));

import { registerUser } from '@/lib/server/auth-service';

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('throws a normalized input error when password is shorter than 8 characters', async () => {
    await expect(
      registerUser({
        email: 'demo@example.com',
        password: '1234567',
        confirmPassword: '1234567',
      }),
    ).rejects.toThrow('INVALID_REGISTRATION_INPUT');

    expect(userFindUniqueMock).not.toHaveBeenCalled();
    expect(userCreateMock).not.toHaveBeenCalled();
  });
});
