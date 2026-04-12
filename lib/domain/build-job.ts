import fs from 'node:fs/promises';
import path from 'node:path';

import {
  detectForbiddenAbsoluteReferences,
  normalizeForbiddenAbsoluteReferences,
} from '@/lib/domain/upload-validation';

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

type InstallCommandOptions = {
  cacheDir?: string | null;
  registry?: string | null;
};

const LINUX_MAX_OPEN_FILES_RE = /^Max open files\s+(\d+|unlimited)\s+(\d+|unlimited)\s+files$/mi;
const PUBLISHABLE_TEXT_EXTENSIONS = new Set(['.css', '.html']);

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

export function parseLinuxOpenFileLimit(limitsText: string) {
  const match = limitsText.match(LINUX_MAX_OPEN_FILES_RE);
  if (!match) {
    return null;
  }

  const soft = match[1] === 'unlimited' ? Number.POSITIVE_INFINITY : Number.parseInt(match[1], 10);
  const hard = match[2] === 'unlimited' ? Number.POSITIVE_INFINITY : Number.parseInt(match[2], 10);

  if (Number.isNaN(soft) || Number.isNaN(hard)) {
    return null;
  }

  return { soft, hard };
}

export function getOpenFileLimitRequirementMessage(limit: { soft: number; hard: number } | null, minimum = 4096) {
  if (!limit || limit.soft >= minimum) {
    return null;
  }

  const soft = Number.isFinite(limit.soft) ? String(limit.soft) : 'unlimited';
  const hard = Number.isFinite(limit.hard) ? String(limit.hard) : 'unlimited';

  return [
    `当前容器的 Max open files 过低（soft=${soft}, hard=${hard}）。`,
    '这会导致 Vite/Tailwind 在构建阶段出现伪装成依赖缺失的错误。',
    `请以至少 ${minimum} 的 nofile 限制启动容器，例如：docker run --ulimit nofile=65535:65535 ...`,
  ].join('');
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

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectPublishableTextFiles(rootDir: string) {
  const collected: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await walk(entryPath);
          return;
        }

        if (PUBLISHABLE_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          collected.push(entryPath);
        }
      }),
    );
  }

  await walk(rootDir);

  return collected.sort();
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

  if (await pathExists(path.join(projectDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (await pathExists(path.join(projectDir, 'package-lock.json'))) {
    return 'npm';
  }

  throw new Error('Unable to detect package manager from package.json or lock file');
}

export async function getInstallCommand(
  projectDir: string,
  packageManager: PackageManagerName,
  options: InstallCommandOptions = {},
) {
  const cacheDir = options.cacheDir?.trim();
  const registry = options.registry?.trim();
  const cacheArg = cacheDir
    ? [packageManager === 'pnpm' ? `--store-dir=${cacheDir}` : `--cache=${cacheDir}`]
    : [];
  const registryArg = registry ? [`--registry=${registry}`] : [];

  if (packageManager === 'pnpm') {
    const args = ['pnpm', 'install'];
    if (await pathExists(path.join(projectDir, 'pnpm-lock.yaml'))) {
      args.push('--frozen-lockfile');
    }
    args.push('--prod=false', ...cacheArg, ...registryArg);
    return args.join(' ');
  }

  const args = ['npm', (await pathExists(path.join(projectDir, 'package-lock.json'))) ? 'ci' : 'install', '--include=dev'];
  args.push(...cacheArg, ...registryArg);
  return args.join(' ');
}

export async function validateBuildOutput(distDir: string) {
  const indexHtmlPath = path.join(distDir, 'index.html');

  let indexHtml: string;
  try {
    indexHtml = await fs.readFile(indexHtmlPath, 'utf8');
  } catch {
    throw new Error('Build output must contain dist/index.html');
  }

  const publishableFiles = await collectPublishableTextFiles(distDir);
  const forbiddenReferences: string[] = [];

  for (const filePath of publishableFiles) {
    const content = filePath === indexHtmlPath ? indexHtml : await fs.readFile(filePath, 'utf8');
    const relativeFilePath = path.relative(distDir, filePath).split(path.sep).join('/');

    for (const reference of detectForbiddenAbsoluteReferences(content)) {
      forbiddenReferences.push(`${relativeFilePath} -> ${reference}`);
    }
  }

  if (forbiddenReferences.length > 0) {
    throw new Error(`Detected root absolute asset references: ${forbiddenReferences.join(', ')}`);
  }

  return {
    distDir,
    indexHtmlPath,
    checkedFilesCount: publishableFiles.length,
  };
}

export async function normalizeBuildOutputPaths(distDir: string) {
  const publishableFiles = await collectPublishableTextFiles(distDir);
  const remainingForbiddenReferences: string[] = [];
  let rewrittenCount = 0;
  let rewrittenFilesCount = 0;

  for (const filePath of publishableFiles) {
    const originalContent = await fs.readFile(filePath, 'utf8');
    const relativeDir = path.relative(distDir, path.dirname(filePath));
    const normalized = normalizeForbiddenAbsoluteReferences(originalContent, relativeDir);

    if (normalized.rewrittenCount > 0) {
      rewrittenCount += normalized.rewrittenCount;
      rewrittenFilesCount += 1;
      await fs.writeFile(filePath, normalized.content, 'utf8');
    }

    const relativeFilePath = path.relative(distDir, filePath).split(path.sep).join('/');
    for (const reference of detectForbiddenAbsoluteReferences(normalized.content)) {
      remainingForbiddenReferences.push(`${relativeFilePath} -> ${reference}`);
    }
  }

  return {
    rewritten: rewrittenCount > 0,
    rewrittenCount,
    rewrittenFilesCount,
    scannedFilesCount: publishableFiles.length,
    indexHtmlPath: path.join(distDir, 'index.html'),
    remainingForbiddenReferences,
  };
}
