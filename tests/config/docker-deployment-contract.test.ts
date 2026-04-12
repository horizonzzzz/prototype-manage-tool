import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

function getStageBlock(dockerfile: string, stageName: string) {
  const pattern = new RegExp(`FROM\\s+.+\\s+AS\\s+${stageName}\\s*([\\s\\S]*?)(?=\\nFROM\\s+|$)`, 'i');
  return dockerfile.match(pattern)?.[1] ?? '';
}

describe('Docker deployment contract', () => {
  test('runner image keeps prisma config required for db:push commands', () => {
    const dockerfile = readProjectSource('Dockerfile');
    const runnerStage = getStageBlock(dockerfile, 'runner');

    expect(readProjectSource('prisma.config.ts')).toContain("defineConfig({");
    expect(readProjectSource('package.json')).toContain('"db:push": "prisma db push"');
    expect(runnerStage).toContain('COPY --from=builder /app/prisma.config.ts ./prisma.config.ts');
  });

  test('docker publish workflow follows the master release branch', () => {
    const workflow = readProjectSource('.github/workflows/docker-publish.yml');

    expect(workflow).toContain('      - master');
    expect(workflow).toContain("github.ref == 'refs/heads/master'");
    expect(workflow).not.toContain("github.ref == 'refs/heads/main'");
  });

  test('docker example environment recommends a versioned image tag', () => {
    const envExample = readProjectSource('.env.docker.example');

    expect(envExample).toMatch(/^IMAGE_TAG=v.+$/m);
    expect(envExample).not.toContain('IMAGE_TAG=latest');
  });

  test('runner image normalizes entrypoint line endings before execution', () => {
    const dockerfile = readProjectSource('Dockerfile');
    const runnerStage = getStageBlock(dockerfile, 'runner');

    expect(readProjectSource('docker/entrypoint.sh')).toContain('#!/bin/sh');
    expect(runnerStage).toContain("sed -i 's/\\r$//' /entrypoint.sh");
  });

  test('runner image preinstalls the pinned pnpm version for offline db-init commands', () => {
    const dockerfile = readProjectSource('Dockerfile');
    const runnerStage = getStageBlock(dockerfile, 'runner');

    expect(readProjectSource('package.json')).toContain('"packageManager": "pnpm@10.33.0"');
    expect(runnerStage).toContain('corepack prepare pnpm@10.33.0 --activate');
  });
});
