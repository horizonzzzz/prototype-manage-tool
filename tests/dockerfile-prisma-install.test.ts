import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

type PackageJson = {
  scripts?: Record<string, string | undefined>;
};

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
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
});
