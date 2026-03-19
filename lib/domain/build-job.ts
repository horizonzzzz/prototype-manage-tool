import fs from 'node:fs/promises';
import path from 'node:path';

import { detectForbiddenAbsoluteReferences } from '@/lib/domain/upload-validation';

const ROOT_ASSET_REFERENCE = /\b(src|href)=(["'])(\/(?!\/)[^"']+)\2/gi;

export const BUILD_JOB_STEP_ORDER = ['extract', 'install', 'build', 'normalize', 'validate', 'publish'] as const;

export type BuildJobStepKey = (typeof BUILD_JOB_STEP_ORDER)[number];
export type BuildJobStepStatus = 'pending' | 'running' | 'success' | 'failed';
export type PackageManagerName = 'pnpm' | 'npm';

export type BuildJobStep = {
  key: BuildJobStepKey;
  label: string;
  status: BuildJobStepStatus;
  message: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

const STEP_LABELS: Record<BuildJobStepKey, string> = {
  extract: '解压源码包',
  install: '安装依赖',
  build: '执行构建',
  normalize: '规范化资源路径',
  validate: '校验构建产物',
  publish: '发布 dist',
};

export function buildInitialJobSteps(): BuildJobStep[] {
  return BUILD_JOB_STEP_ORDER.map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: 'pending',
    message: null,
    startedAt: null,
    completedAt: null,
  }));
}

export function updateJobSteps(
  steps: BuildJobStep[],
  key: BuildJobStepKey,
  status: BuildJobStepStatus,
  message?: string | null,
) {
  const now = new Date().toISOString();

  return steps.map((step) => {
    if (step.key !== key) {
      return step;
    }

    return {
      ...step,
      status,
      message: message ?? step.message,
      startedAt: status === 'running' && !step.startedAt ? now : step.startedAt,
      completedAt: status === 'success' || status === 'failed' ? now : step.completedAt,
    };
  });
}

export function getJobProgressPercent(steps: BuildJobStep[]) {
  if (steps.length === 0) {
    return 0;
  }

  const completedCount = steps.filter((step) => step.status === 'success').length;
  const runningCount = steps.filter((step) => step.status === 'running').length;
  return Math.round(((completedCount + runningCount * 0.5) / steps.length) * 100);
}

export function getCurrentJobStep(steps: BuildJobStep[]) {
  return (
    steps.find((step) => step.status === 'running') ??
    steps.find((step) => step.status === 'failed') ??
    [...steps].reverse().find((step) => step.status === 'success') ??
    null
  );
}

export function stringifyJobSteps(steps: BuildJobStep[]) {
  return JSON.stringify(steps);
}

export function parseJobSteps(stepsJson?: string | null) {
  if (!stepsJson) {
    return buildInitialJobSteps();
  }

  try {
    const parsed = JSON.parse(stepsJson) as BuildJobStep[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : buildInitialJobSteps();
  } catch {
    return buildInitialJobSteps();
  }
}

async function readPackageJson(projectDir: string) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf8');
  const parsed = JSON.parse(content) as {
    packageManager?: string;
    scripts?: Record<string, string>;
  };

  if (!parsed.scripts?.build) {
    throw new Error('package.json must define a build script');
  }

  return parsed;
}

export async function detectPackageManager(projectDir: string): Promise<PackageManagerName> {
  const packageJson = await readPackageJson(projectDir);
  const packageManager = packageJson.packageManager?.split('@')[0];

  if (packageManager === 'pnpm' || packageManager === 'npm') {
    return packageManager;
  }

  if (packageManager) {
    throw new Error('Only pnpm and npm projects are supported');
  }

  try {
    await fs.access(path.join(projectDir, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {}

  try {
    await fs.access(path.join(projectDir, 'package-lock.json'));
    return 'npm';
  } catch {}

  throw new Error('Unable to detect package manager from package.json or lock file');
}

export async function validateBuildOutput(distDir: string) {
  const indexHtmlPath = path.join(distDir, 'index.html');

  let indexHtml: string;
  try {
    indexHtml = await fs.readFile(indexHtmlPath, 'utf8');
  } catch {
    throw new Error('Build output must contain dist/index.html');
  }

  const forbiddenReferences = detectForbiddenAbsoluteReferences(indexHtml);
  if (forbiddenReferences.length > 0) {
    throw new Error(`Detected root absolute asset references: ${forbiddenReferences.join(', ')}`);
  }

  return {
    distDir,
    indexHtmlPath,
  };
}

export async function normalizeBuildOutputPaths(distDir: string) {
  const indexHtmlPath = path.join(distDir, 'index.html');
  const originalHtml = await fs.readFile(indexHtmlPath, 'utf8');
  let rewrittenCount = 0;

  const normalizedHtml = originalHtml.replace(ROOT_ASSET_REFERENCE, (match, attribute, quote, assetPath) => {
    if (assetPath.startsWith('/api/') || assetPath.startsWith('/prototypes/')) {
      return match;
    }

    rewrittenCount += 1;
    return `${attribute}=${quote}.${assetPath}${quote}`;
  });

  if (rewrittenCount > 0) {
    await fs.writeFile(indexHtmlPath, normalizedHtml, 'utf8');
  }

  return {
    rewritten: rewrittenCount > 0,
    rewrittenCount,
    indexHtmlPath,
    remainingForbiddenReferences: detectForbiddenAbsoluteReferences(normalizedHtml),
  };
}
