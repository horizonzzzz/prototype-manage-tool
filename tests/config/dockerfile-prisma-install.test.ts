import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

type PackageJson = {
  scripts?: Record<string, string | undefined>;
};

function readRepoFile(relativePath: string) {
  return readProjectSource(relativePath);
}

function getStageBlock(dockerfile: string, stageName: string) {
  const pattern = new RegExp(`FROM\\s+.+\\s+AS\\s+${stageName}\\s*([\\s\\S]*?)(?=\\nFROM\\s+|$)`, 'i');
  return dockerfile.match(pattern)?.[1] ?? '';
}

describe('Dockerfile Prisma install flow', () => {
  test('makes Prisma schema available before deps install when postinstall generates the client', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as PackageJson;
    const dockerfile = readRepoFile('Dockerfile');
    const depsStage = getStageBlock(dockerfile, 'deps');
    const postinstall = packageJson.scripts?.postinstall ?? '';

    expect(postinstall).toContain('prisma:generate');

    const depsStageLines = depsStage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const installIndex = depsStageLines.findIndex((line) => line.startsWith('RUN ') && line.includes('pnpm install'));

    expect(installIndex).toBeGreaterThanOrEqual(0);

    const installCommand = installIndex >= 0 ? depsStageLines[installIndex] : '';
    const schemaCopiedBeforeInstall = depsStageLines
      .slice(0, installIndex)
      .some((line) => line.startsWith('COPY ') && /\bprisma\b/.test(line));

    expect(
      schemaCopiedBeforeInstall || installCommand.includes('--ignore-scripts'),
      'deps stage must copy Prisma schema before pnpm install or disable install scripts',
    ).toBe(true);
  });

  test('provides a DATABASE_URL before deps install when Prisma config requires it', () => {
    const packageJson = JSON.parse(readRepoFile('package.json')) as PackageJson;
    const dockerfile = readRepoFile('Dockerfile');
    const depsStage = getStageBlock(dockerfile, 'deps');
    const postinstall = packageJson.scripts?.postinstall ?? '';

    expect(readRepoFile('prisma.config.ts')).toContain('env(');
    expect(postinstall).toContain('prisma:generate');

    const depsStageLines = depsStage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const installIndex = depsStageLines.findIndex((line) => line.startsWith('RUN ') && line.includes('pnpm install'));
    const envProvidedBeforeInstall = depsStageLines
      .slice(0, installIndex + 1)
      .some((line) => line.includes('DATABASE_URL='));

    expect(
      envProvidedBeforeInstall || depsStageLines[installIndex]?.includes('--ignore-scripts'),
      'deps stage must provide DATABASE_URL before pnpm install or disable install scripts',
    ).toBe(true);
  });

  test('copies pnpm workspace config before deps install so approved native builds can run', () => {
    const dockerfile = readRepoFile('Dockerfile');
    const depsStage = getStageBlock(dockerfile, 'deps');
    const depsStageLines = depsStage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(readRepoFile('pnpm-workspace.yaml')).toContain('allowBuilds:');

    const installIndex = depsStageLines.findIndex((line) => line.startsWith('RUN ') && line.includes('pnpm install'));
    const workspaceCopiedBeforeInstall = depsStageLines
      .slice(0, installIndex)
      .some((line) => line.startsWith('COPY ') && /\bpnpm-workspace\.yaml\b/.test(line));

    expect(
      workspaceCopiedBeforeInstall,
      'deps stage must copy pnpm-workspace.yaml before pnpm install so native build approvals apply',
    ).toBe(true);
  });

  test('uses an absolute build-time DATABASE_URL under /app/data/sqlite', () => {
    const dockerfile = readRepoFile('Dockerfile');
    const depsStage = getStageBlock(dockerfile, 'deps');
    const databaseUrlLine = depsStage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('ENV DATABASE_URL='));

    expect(databaseUrlLine).toBeDefined();
    expect(databaseUrlLine).toContain('file:/app/data/sqlite/app.db');
  });

  test('initializes the build-time sqlite schema before next build prerenders pages', () => {
    const dockerfile = readRepoFile('Dockerfile');
    const builderStage = getStageBlock(dockerfile, 'builder');
    const builderStageLines = builderStage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    expect(readRepoFile('app/[locale]/(preview)/preview/page.tsx')).toContain('getManifest');
    expect(readRepoFile('lib/server/manifest-service.ts')).toContain('prisma.product.findMany');

    const dbPushIndex = builderStageLines.findIndex((line) => line.startsWith('RUN ') && line.includes('pnpm db:push'));
    const buildIndex = builderStageLines.findIndex((line) => line.startsWith('RUN ') && line.includes('pnpm build'));

    expect(dbPushIndex, 'builder stage must initialize SQLite schema before next build').toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(dbPushIndex).toBeLessThan(buildIndex);
  });
});
