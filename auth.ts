import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { appConfig } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { authenticateUser, loginSchema } from '@/lib/server/auth-service';

export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
  adapter: PrismaAdapter(prisma as never),
  secret: appConfig.authSecret,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await authenticateUser(parsed.data.email, parsed.data.password);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }

      if (trigger === 'update' && session?.user) {
        if (typeof session.user.name === 'string') {
          token.name = session.user.name;
        }

        if (typeof session.user.email === 'string') {
          token.email = session.user.email;
        }

        token.picture = typeof session.user.image === 'string' ? session.user.image : null;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.name = typeof token.name === 'string' ? token.name : undefined;
        session.user.email = typeof token.email === 'string' ? token.email : '';
        session.user.image = typeof token.picture === 'string' ? token.picture : null;
      }

      return session;
    },
  },
});
