import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'next/server': path.resolve(__dirname, 'node_modules/next/server.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      enabled: false,
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx,mts,mjs}'],
      exclude: [
        '**/*.d.ts',
        '**/*.config.*',
        'tests/**',
        'data/**',
        'coverage/**',
        '.next/**',
        'prisma/**',
      ],
    },
  },
});
