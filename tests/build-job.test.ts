import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  buildInitialJobSteps,
  detectPackageManager,
  getCurrentJobStep,
  getJobProgressPercent,
  normalizeBuildOutputPaths,
  parseJobSteps,
  stringifyJobSteps,
  updateJobSteps,
  validateBuildOutput,
} from '@/lib/domain/build-job';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createTempProject(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-job-'));
  tempDirs.push(dir);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const targetPath = path.join(dir, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, 'utf8');
    }),
  );

  return dir;
}

describe('build job domain helpers', () => {
  test('detects pnpm from packageManager field', async () => {
    const projectDir = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo',
        packageManager: 'pnpm@10.0.0',
        scripts: { build: 'vite build' },
      }),
    });

    await expect(detectPackageManager(projectDir)).resolves.toBe('pnpm');
  });

  test('detects npm from lock file when packageManager is absent', async () => {
    const projectDir = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo',
        scripts: { build: 'vite build' },
      }),
      'package-lock.json': '{}',
    });

    await expect(detectPackageManager(projectDir)).resolves.toBe('npm');
  });

  test('rejects unsupported package managers', async () => {
    const projectDir = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo',
        packageManager: 'yarn@4.0.0',
        scripts: { build: 'vite build' },
      }),
    });

    await expect(detectPackageManager(projectDir)).rejects.toThrow('Only pnpm and npm projects are supported');
  });

  test('builds initial pending steps and zero progress', () => {
    const steps = buildInitialJobSteps();

    expect(steps.map((step) => step.status)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
    expect(getJobProgressPercent(steps)).toBe(0);
  });

  test('updates job steps and progress from running to success', () => {
    let steps = buildInitialJobSteps();

    steps = updateJobSteps(steps, 'extract', 'running');
    expect(steps.find((step) => step.key === 'extract')).toMatchObject({ status: 'running' });
    expect(getJobProgressPercent(steps)).toBe(8);

    steps = updateJobSteps(steps, 'extract', 'success');
    steps = updateJobSteps(steps, 'install', 'success');
    expect(getJobProgressPercent(steps)).toBe(33);
    expect(getCurrentJobStep(steps)?.key).toBe('install');
  });

  test('serializes and parses job steps safely', () => {
    const steps = updateJobSteps(buildInitialJobSteps(), 'extract', 'success', '解压完成');

    expect(parseJobSteps(stringifyJobSteps(steps))).toEqual(steps);
    expect(parseJobSteps('')).toEqual(buildInitialJobSteps());
  });

  test('validates dist index and absolute asset references', async () => {
    const validDir = await createTempProject({
      'dist/index.html': '<html><head><script src="./assets/app.js"></script></head></html>',
    });
    await expect(validateBuildOutput(path.join(validDir, 'dist'))).resolves.toEqual(
      expect.objectContaining({ indexHtmlPath: path.join(validDir, 'dist', 'index.html') }),
    );

    const invalidDir = await createTempProject({
      'dist/index.html': '<html><head><script src="/assets/app.js"></script></head></html>',
    });
    await expect(validateBuildOutput(path.join(invalidDir, 'dist'))).rejects.toThrow(
      'Detected root absolute asset references',
    );
  });

  test('normalizes root absolute asset references in dist index.html', async () => {
    const projectDir = await createTempProject({
      'dist/index.html':
        '<html><head><link rel="stylesheet" href="/assets/app.css" /><script src="/assets/app.js"></script></head></html>',
    });

    const result = await normalizeBuildOutputPaths(path.join(projectDir, 'dist'));
    const rewrittenHtml = await fs.readFile(path.join(projectDir, 'dist', 'index.html'), 'utf8');

    expect(result.rewritten).toBe(true);
    expect(result.rewrittenCount).toBe(2);
    expect(rewrittenHtml).toContain('./assets/app.css');
    expect(rewrittenHtml).toContain('./assets/app.js');
    await expect(validateBuildOutput(path.join(projectDir, 'dist'))).resolves.toEqual(
      expect.objectContaining({ indexHtmlPath: path.join(projectDir, 'dist', 'index.html') }),
    );
  });

  test('keeps allowed platform paths unchanged when normalizing output', async () => {
    const projectDir = await createTempProject({
      'dist/index.html':
        '<html><head><script src="/api/manifest"></script><script src="/prototypes/demo/v1/index.html"></script></head></html>',
    });

    const result = await normalizeBuildOutputPaths(path.join(projectDir, 'dist'));
    const rewrittenHtml = await fs.readFile(path.join(projectDir, 'dist', 'index.html'), 'utf8');

    expect(result.rewritten).toBe(false);
    expect(result.rewrittenCount).toBe(0);
    expect(rewrittenHtml).toContain('/api/manifest');
    expect(rewrittenHtml).toContain('/prototypes/demo/v1/index.html');
  });

  test('fails when build output misses dist index.html', async () => {
    const projectDir = await createTempProject({
      'dist/assets/app.js': 'console.log("hi")',
    });

    await expect(validateBuildOutput(path.join(projectDir, 'dist'))).rejects.toThrow(
      'Build output must contain dist/index.html',
    );
  });
});
