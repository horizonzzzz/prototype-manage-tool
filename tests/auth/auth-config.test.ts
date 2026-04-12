import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

const authSource = readProjectSource('auth.ts');

describe('auth configuration', () => {
  test('uses jwt sessions for credentials auth and maps user id into the session', () => {
    expect(authSource).toContain("session: { strategy: 'jwt' }");
    expect(authSource).toContain('async jwt(');
    expect(authSource).toContain('session.user.id');
    expect(authSource).toContain('token.sub');
  });
});
