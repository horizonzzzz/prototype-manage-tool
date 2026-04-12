import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/server/password';

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const registerSchema = loginSchema.extend({
  confirmPassword: z.string().min(8),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildUserName(email: string) {
  return normalizeEmail(email).split('@')[0] || 'user';
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.parse(input);
  if (parsed.password !== parsed.confirmPassword) {
    throw new Error('PASSWORD_MISMATCH');
  }

  const email = normalizeEmail(parsed.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  return await prisma.user.create({
    data: {
      email,
      name: buildUserName(email),
      passwordHash: hashPassword(parsed.password),
    },
  });
}
