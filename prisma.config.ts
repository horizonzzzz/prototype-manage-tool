import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';
import path from 'node:path';

import { resolveSqliteFileUrl } from './lib/sqlite-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: resolveSqliteFileUrl(env('DATABASE_URL'), path.join(process.cwd(), 'prisma')),
  },
});
