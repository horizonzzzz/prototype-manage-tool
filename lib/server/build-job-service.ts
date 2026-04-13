import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import {
  buildInitialJobSteps,
  detectPackageManager,
  getOpenFileLimitRequirementMessage,
  getInstallCommand,
  getCurrentJobStep,
  normalizeBuildOutputPaths,
  parseJobSteps,
  parseLinuxOpenFileLimit,
  stringifyJobSteps,
  type BuildJobStep,
  type BuildJobStepKey,
  updateJobSteps,
  validateBuildOutput,
} from '@/lib/domain/build-job';
import { normalizeUploadFileName } from '@/lib/domain/upload-validation';
import { prisma } from '@/lib/prisma';
import {
  createBuildJobLogStreamResponse,
  publishBuildJobLogChunk,
  publishBuildJobLogStatus,
} from '@/lib/server/build-job-log-stream';
import { ensureAppDirectories, extractZipToTemp, findFileRoot, publishExtractedDir } from '@/lib/server/fs-utils';
import { serializeUploadRecord } from '@/lib/server/serializers';
import { createSourceSnapshot } from '@/lib/server/source-snapshot-service';
import { buildBuildJobStageText, isBuildJobLogStep, isBuildJobLogStreamStep } from '@/lib/ui/build-job-log';
import type { BuildJobLogItem, BuildJobLogStep, BuildJobLogStreamStep } from '@/lib/types';

type BuildJobInput = {
  userId: string;
  productKey: string;
  version: string;
  title?: string;
  remark?: string;
  fileName: string;
  fileSize: number;
  buffer: Buffer;
};

type ProjectPackageJson = {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
};

type QueueState = {
  queue: number[];
  active: Set<number>;
  draining: boolean;
};

type RunShellCommandOptions = {
  onChunk?: (chunk: string) => void;
};

type BuildJobLiveLogSink = {
  append: (chunk: string) => void;
  close: () => Promise<void>;
};

const globalQueueState = globalThis as typeof globalThis & {
  __buildJobQueueState__?: QueueState;
};

function getQueueState(): QueueState {
  if (!globalQueueState.__buildJobQueueState__) {
    globalQueueState.__buildJobQueueState__ = {
      queue: [],
      active: new Set<number>(),
      draining: false,
    };
  }

  return globalQueueState.__buildJobQueueState__;
}

function buildEntryUrl(userId: string, productKey: string, version: string) {
  return `/prototypes/${userId}/${productKey}/${version}/index.html`;
}

function getJobPaths(jobId: number, fileName: string) {
  const jobDir = path.join(appConfig.buildJobsDir, String(jobId));
  return {
    jobDir,
    archivePath: path.join(jobDir, normalizeUploadFileName(fileName)),
    workspacePath: path.join(jobDir, 'workspace'),
    extractPath: path.join(jobDir, 'workspace', 'extract'),
  };
}

async function readProjectPackageJson(projectDir: string) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf8');
  return JSON.parse(content) as ProjectPackageJson;
}

async function getOpenFileLimitErrorMessage() {
  try {
    const limitsText = await fs.readFile('/proc/self/limits', 'utf8');
    return getOpenFileLimitRequirementMessage(parseLinuxOpenFileLimit(limitsText));
  } catch {
    return null;
  }
}

function summarizeOutput(output: string, fallback: string, maxLines = 50) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return fallback;
  }

  const summary = lines.slice(-maxLines).join('\n');
  return summary.length > 4000 ? `${summary.slice(summary.length - 4000)}` : summary;
}

async function runShellCommand(command: string, cwd: string, options: RunShellCommandOptions = {}) {
  return await new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        CI: '1',
      },
      windowsHide: true,
    });

    let output = '';
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      options.onChunk?.(text);
    });
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      options.onChunk?.(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

async function createBuildJobLiveLogSink(jobId: number, workspacePath: string, step: BuildJobLogStreamStep): Promise<BuildJobLiveLogSink> {
  await fse.ensureDir(workspacePath);
  const logPath = path.join(workspacePath, `${step}.log`);
  await fs.writeFile(logPath, '', 'utf8');

  const stream = createWriteStream(logPath, {
    flags: 'a',
    encoding: 'utf8',
  });
  let closed = false;

  return {
    append(chunk) {
      stream.write(chunk);
      publishBuildJobLogChunk(jobId, step, chunk);
    },
    async close() {
      if (closed) {
        return;
      }

      closed = true;
      await new Promise<void>((resolve, reject) => {
        stream.once('error', reject);
        stream.end(() => resolve());
      }).catch(() => {});
    },
  };
}

async function updateJobRecord(
  jobId: number,
  steps: BuildJobStep[],
  data: Partial<{
    status: string;
    currentStep: string | null;
    logSummary: string | null;
    errorMessage: string | null;
    sourceArchivePath: string | null;
    workspacePath: string | null;
    publishedPath: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
) {
  await prisma.uploadRecord.update({
    where: { id: jobId },
    data: {
      stepsJson: stringifyJobSteps(steps),
      ...data,
    },
  });
}

async function markStep(jobId: number, steps: BuildJobStep[], stepKey: BuildJobStepKey, status: 'running' | 'success' | 'failed', message: string) {
  const nextSteps = updateJobSteps(steps, stepKey, status, message);
  const currentStep = getCurrentJobStep(nextSteps);

  await updateJobRecord(jobId, nextSteps, {
    status: status === 'failed' ? 'failed' : status === 'running' ? 'running' : undefined,
    currentStep: currentStep?.key ?? stepKey,
    logSummary: message,
    errorMessage: status === 'failed' ? message : null,
    startedAt: status === 'running' ? new Date() : undefined,
    completedAt: status === 'failed' ? new Date() : undefined,
  });

  return nextSteps;
}

async function finalizeBuildJobSuccess(jobId: number, publishedPath: string, steps: BuildJobStep[]) {
  await prisma.$transaction(async (transaction) => {
    const job = await transaction.uploadRecord.findUniqueOrThrow({ where: { id: jobId } });
    const version = await transaction.productVersion.findFirst({
      where: {
        product: {
          key: job.productKey,
          ownerId: job.userId,
        },
        version: job.version,
      },
    });

    const targetVersion = version!;
    await transaction.productVersion.updateMany({
      where: { productId: targetVersion.productId },
      data: { isDefault: false },
    });

    await transaction.productVersion.update({
      where: { id: targetVersion.id },
        data: {
          status: 'published',
          storagePath: publishedPath,
          entryUrl: buildEntryUrl(job.userId, job.productKey, job.version),
          isDefault: true,
        },
      });

    await transaction.uploadRecord.update({
      where: { id: jobId },
      data: {
        status: 'success',
        currentStep: getCurrentJobStep(steps)?.key ?? 'publish',
        stepsJson: stringifyJobSteps(steps),
        logSummary: '源码包已成功构建并发布',
        errorMessage: null,
        publishedPath,
        completedAt: new Date(),
      },
    });

    void job;
  });
}

async function finalizeBuildJobFailure(jobId: number, message: string, steps: BuildJobStep[]) {
  const job = await prisma.uploadRecord.findUnique({ where: { id: jobId } });
  if (!job) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const version = await transaction.productVersion.findFirst({
      where: {
        product: { key: job.productKey, ownerId: job.userId },
        version: job.version,
      },
    });

    if (version) {
      await transaction.productVersion.update({
        where: { id: version.id },
        data: { status: 'failed', isDefault: false },
      });
    }

    await transaction.uploadRecord.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        currentStep: getCurrentJobStep(steps)?.key ?? job.currentStep,
        stepsJson: stringifyJobSteps(steps),
        logSummary: message,
        errorMessage: message,
        completedAt: new Date(),
      },
    });
  });
}

async function runBuildJob(jobId: number) {
  const job = await prisma.uploadRecord.findUnique({ where: { id: jobId } });
  if (!job) {
    return;
  }

  const { archivePath, extractPath, jobDir, workspacePath } = getJobPaths(job.id, job.fileName);
  let steps = parseJobSteps(job.stepsJson);
  let publishedPath: string | null = null;
  let activeLogStep: BuildJobLogStreamStep | null = null;
  let activeLogSink: BuildJobLiveLogSink | null = null;

  try {
    steps = await markStep(jobId, steps, 'extract', 'running', '正在解压源码包');
    await fse.ensureDir(extractPath);
    await extractZipToTemp(archivePath, extractPath);

    const projectRoot = await findFileRoot(extractPath, 'package.json');
    if (!projectRoot) {
      throw new Error('源码包中必须包含 package.json');
    }

    const targetVersion = await prisma.productVersion.findFirst({
      where: {
        product: { key: job.productKey, ownerId: job.userId },
        version: job.version,
      },
      select: { id: true },
    });
    if (!targetVersion) {
      throw new Error('Version not found');
    }
    await createSourceSnapshot({
      userId: job.userId,
      versionId: targetVersion.id,
      productKey: job.productKey,
      version: job.version,
      sourceDir: projectRoot,
    });

    const packageManager = await detectPackageManager(projectRoot);
    const packageJson = await readProjectPackageJson(projectRoot);
    steps = await markStep(
      jobId,
      steps,
      'extract',
      'success',
      `已识别项目 ${packageJson.name || '未命名项目'}，使用 ${packageManager}`,
    );

    // 删除已有的 node_modules，确保全新安装（避免跨平台或不完整的依赖）
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    await fse.remove(nodeModulesPath).catch(() => {});
    const packageManagerCacheDir = path.join(jobDir, packageManager === 'pnpm' ? 'pnpm-store' : 'npm-cache');

    steps = await markStep(jobId, steps, 'install', 'running', `正在使用 ${packageManager} 安装依赖`);
    activeLogStep = 'install';
    activeLogSink = await createBuildJobLiveLogSink(jobId, workspacePath, 'install');
    const installResult = await runShellCommand(
      await getInstallCommand(projectRoot, packageManager, {
        cacheDir: packageManagerCacheDir,
        registry: process.env.BUILD_JOB_NPM_REGISTRY,
      }),
      projectRoot,
      {
        onChunk: (chunk) => activeLogSink?.append(chunk),
      },
    );
    await activeLogSink.close();
    activeLogSink = null;

    if (installResult.code !== 0) {
      const installMessage = `依赖安装失败\n${summarizeOutput(installResult.output, '依赖安装失败')}`;
      publishBuildJobLogStatus(jobId, 'install', 'failed', installMessage);
      activeLogStep = null;
      throw new Error(installMessage);
    }
    steps = await markStep(jobId, steps, 'install', 'success', summarizeOutput(installResult.output, '依赖安装完成'));
    publishBuildJobLogStatus(jobId, 'install', 'success');
    activeLogStep = null;

    const openFileLimitError = await getOpenFileLimitErrorMessage();
    if (openFileLimitError) {
      throw new Error(openFileLimitError);
    }

    steps = await markStep(jobId, steps, 'build', 'running', '正在执行构建脚本');
    activeLogStep = 'build';
    activeLogSink = await createBuildJobLiveLogSink(jobId, workspacePath, 'build');
    const buildResult = await runShellCommand(`${packageManager} run build`, projectRoot, {
      onChunk: (chunk) => activeLogSink?.append(chunk),
    });
    await activeLogSink.close();
    activeLogSink = null;

    if (buildResult.code !== 0) {
      const buildMessage = `项目构建失败\n${summarizeOutput(buildResult.output, '项目构建失败')}`;
      publishBuildJobLogStatus(jobId, 'build', 'failed', buildMessage);
      activeLogStep = null;
      throw new Error(buildMessage);
    }
    steps = await markStep(jobId, steps, 'build', 'success', summarizeOutput(buildResult.output, '项目构建完成'));
    publishBuildJobLogStatus(jobId, 'build', 'success');
    activeLogStep = null;

    steps = await markStep(jobId, steps, 'normalize', 'running', '正在规范化 dist 资源路径');
    const distDir = path.join(projectRoot, 'dist');
    const normalizeResult = await normalizeBuildOutputPaths(distDir);
    const normalizeMessage = normalizeResult.rewritten
      ? `已自动修正 ${normalizeResult.rewrittenFilesCount} 个文件中的 ${normalizeResult.rewrittenCount} 处资源路径`
      : '未发现需要修正的资源路径';
    steps = await markStep(jobId, steps, 'normalize', 'success', normalizeMessage);

    steps = await markStep(jobId, steps, 'validate', 'running', '正在校验 dist 产物');
    await validateBuildOutput(distDir);
    steps = await markStep(jobId, steps, 'validate', 'success', 'dist/index.html 校验通过');

    steps = await markStep(jobId, steps, 'publish', 'running', '正在发布 dist 目录');
    publishedPath = await publishExtractedDir(job.userId, job.productKey, job.version, distDir);
    steps = await markStep(jobId, steps, 'publish', 'success', 'dist 已发布到预览目录');

    await finalizeBuildJobSuccess(jobId, publishedPath, steps);
  } catch (error) {
    const message = error instanceof Error ? error.message : '后台构建失败';
    if (activeLogSink) {
      await activeLogSink.close();
    }
    if (activeLogStep) {
      publishBuildJobLogStatus(jobId, activeLogStep, 'failed', message);
    }
    const currentStep = getCurrentJobStep(steps)?.key ?? 'extract';
    steps = updateJobSteps(steps, currentStep, 'failed', message);
    if (publishedPath) {
      await fse.remove(publishedPath);
    }
    await finalizeBuildJobFailure(jobId, message, steps);
  }
}

async function drainQueue() {
  const state = getQueueState();
  if (state.draining) {
    return;
  }

  state.draining = true;
  try {
    while (state.queue.length > 0) {
      const jobId = state.queue.shift();
      if (!jobId || state.active.has(jobId)) {
        continue;
      }

      state.active.add(jobId);
      try {
        await runBuildJob(jobId);
      } finally {
        state.active.delete(jobId);
      }
    }
  } finally {
    state.draining = false;
  }
}

export function scheduleBuildJob(jobId: number) {
  const state = getQueueState();
  if (state.active.has(jobId) || state.queue.includes(jobId)) {
    return;
  }

  state.queue.push(jobId);
  setTimeout(() => {
    void drainQueue();
  }, 0);
}

export async function createBuildJob(input: BuildJobInput) {
  await ensureAppDirectories();

  const safeFileName = normalizeUploadFileName(input.fileName);
  if (input.fileSize > appConfig.uploadMaxBytes) {
    throw new Error(`Zip file exceeds ${process.env.UPLOAD_MAX_MB ?? '200'}MB limit`);
  }

  const product = await prisma.product.findFirst({
    where: { key: input.productKey, ownerId: input.userId },
    include: { versions: true },
  });

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.versions.some((item) => item.version === input.version)) {
    throw new Error('Version already exists under this product');
  }

  const steps = buildInitialJobSteps();
  const entryUrl = buildEntryUrl(input.userId, input.productKey, input.version);

  const { versionRecord, jobRecord } = await prisma.$transaction(async (transaction) => {
    const versionRecord = await transaction.productVersion.create({
      data: {
        productId: product.id,
        version: input.version,
        title: input.title || null,
        remark: input.remark || null,
        storagePath: '',
        entryUrl,
        status: 'building',
        isDefault: false,
      },
    });

    const jobRecord = await transaction.uploadRecord.create({
      data: {
        userId: input.userId,
        productKey: input.productKey,
        version: input.version,
        fileName: safeFileName,
        fileSize: input.fileSize,
        status: 'queued',
        currentStep: 'extract',
        stepsJson: stringifyJobSteps(steps),
        logSummary: '任务已创建，等待后台执行',
      },
    });

    return { versionRecord, jobRecord };
  });

  const { archivePath, workspacePath, jobDir } = getJobPaths(jobRecord.id, safeFileName);

  try {
    await fse.ensureDir(jobDir);
    await fs.writeFile(archivePath, input.buffer);
    await prisma.uploadRecord.update({
      where: { id: jobRecord.id },
      data: {
        sourceArchivePath: archivePath,
        workspacePath,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '源码包保存失败';
    const failedSteps = updateJobSteps(steps, 'extract', 'failed', message);
    await finalizeBuildJobFailure(jobRecord.id, message, failedSteps);
    void versionRecord;
    throw error;
  }

  scheduleBuildJob(jobRecord.id);
  return await getBuildJob(input.userId, jobRecord.id);
}

export async function getBuildJob(userId: string, jobId: number) {
  const record = await prisma.uploadRecord.findFirst({ where: { id: jobId, userId } });
  if (!record) {
    throw new Error('Build job not found');
  }

  return serializeUploadRecord(record);
}

export async function getBuildJobLog(userId: string, jobId: number, step: string): Promise<BuildJobLogItem> {
  if (!isBuildJobLogStep(step)) {
    throw new Error('Unsupported log step');
  }

  const record = await prisma.uploadRecord.findFirst({ where: { id: jobId, userId } });
  if (!record) {
    throw new Error('Build job not found');
  }

  const job = serializeUploadRecord(record);
  const selectedStep = job.steps.find((item) => item.key === step);
  if (!selectedStep) {
    throw new Error('Build job step not found');
  }

  if (step !== 'install' && step !== 'build') {
    return {
      step: step as BuildJobLogStep,
      content: buildBuildJobStageText(job, selectedStep),
      exists: true,
      updatedAt: selectedStep.completedAt ?? selectedStep.startedAt ?? record.completedAt?.toISOString() ?? record.startedAt?.toISOString() ?? record.createdAt.toISOString(),
    };
  }

  const workspacePath = record.workspacePath ?? getJobPaths(record.id, record.fileName).workspacePath;
  const logPath = path.join(workspacePath, `${step}.log`);

  try {
    const [content, stats] = await Promise.all([fs.readFile(logPath, 'utf8'), fs.stat(logPath)]);
    return {
      step: step as BuildJobLogStep,
      content,
      exists: true,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        step: step as BuildJobLogStep,
        content: '',
        exists: false,
        updatedAt: null,
      };
    }

    throw error;
  }
}

export async function getBuildJobLogStreamResponse(userId: string, jobId: number, step: string, signal?: AbortSignal) {
  if (!isBuildJobLogStreamStep(step)) {
    throw new Error('Unsupported realtime log step');
  }

  const record = await prisma.uploadRecord.findFirst({ where: { id: jobId, userId } });
  if (!record) {
    throw new Error('Build job not found');
  }

  const job = serializeUploadRecord(record);
  const selectedStep = job.steps.find((item) => item.key === step);
  if (!selectedStep) {
    throw new Error('Build job step not found');
  }

  return createBuildJobLogStreamResponse(jobId, step, signal, await getBuildJobLog(userId, jobId, step));
}

export async function listBuildJobs(userId: string, productKey: string) {
  const records = await prisma.uploadRecord.findMany({
    where: { userId, productKey },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return records.map(serializeUploadRecord);
}
