import { readProjectSource } from '@/tests/support/project-source';
import { describe, expect, test } from 'vitest';

import {
  applyBuildJobLogStreamEvent,
  buildBuildJobStageText,
  getBuildJobLogStep,
  getBuildJobTerminalSessionKey,
  getBuildJobTerminalWrite,
  isBuildJobLogStep,
  isBuildJobLogStreamStep,
  resolveBuildJobLogRequest,
  shouldStreamBuildJobLog,
} from '@/lib/ui/build-job-log';
import type { BuildJobItem, BuildJobLogItem, BuildJobStepItem } from '@/lib/types';

const buildJobLogHookSource = readProjectSource('components/admin/hooks/use-build-job-log.ts');

function createStep(overrides: Partial<BuildJobStepItem> = {}): BuildJobStepItem {
  return {
    key: 'extract',
    label: '解压源码包',
    status: 'success',
    message: '已识别项目 demo，使用 pnpm',
    startedAt: '2026-03-25T08:00:00.000Z',
    completedAt: '2026-03-25T08:00:01.000Z',
    ...overrides,
  };
}

function createJob(step: BuildJobStepItem, overrides: Partial<BuildJobItem> = {}): BuildJobItem {
  return {
    id: 7,
    productKey: 'demo',
    version: 'v1.0.0',
    fileName: 'demo.zip',
    fileSize: 1024,
    status: 'running',
    currentStep: step.key,
    progressPercent: 50,
    logSummary: '任务执行中',
    errorMessage: null,
    createdAt: '2026-03-25T08:00:00.000Z',
    startedAt: '2026-03-25T08:00:00.000Z',
    completedAt: null,
    steps: [step],
    ...overrides,
  };
}

describe('build job log source helpers', () => {
  test('treats every build phase as viewable in the terminal', () => {
    expect(getBuildJobLogStep('extract')).toBe('extract');
    expect(getBuildJobLogStep('install')).toBe('install');
    expect(getBuildJobLogStep('build')).toBe('build');
    expect(getBuildJobLogStep('normalize')).toBe('normalize');
    expect(getBuildJobLogStep('validate')).toBe('validate');
    expect(getBuildJobLogStep('publish')).toBe('publish');
  });

  test('rejects unknown steps only', () => {
    expect(isBuildJobLogStep('install')).toBe(true);
    expect(isBuildJobLogStep('publish')).toBe(true);
    expect(isBuildJobLogStep('unknown')).toBe(false);
    expect(isBuildJobLogStep(null)).toBe(false);
  });

  test('treats install and build as the only realtime stream steps', () => {
    expect(isBuildJobLogStreamStep('install')).toBe(true);
    expect(isBuildJobLogStreamStep('build')).toBe(true);
    expect(isBuildJobLogStreamStep('extract')).toBe(false);
    expect(isBuildJobLogStreamStep('publish')).toBe(false);
    expect(isBuildJobLogStreamStep(null)).toBe(false);
  });

  test('streams logs only for running install/build steps', () => {
    const installJob = createJob(createStep({ key: 'install', label: '安装依赖', status: 'running', completedAt: null }));
    const buildJob = createJob(createStep({ key: 'build', label: '执行构建', status: 'running', completedAt: null }));
    const finishedInstallJob = createJob(
      createStep({ key: 'install', label: '安装依赖', status: 'success', completedAt: '2026-03-25T08:00:04.000Z' }),
      { status: 'success' },
    );

    expect(shouldStreamBuildJobLog(installJob, 'install')).toBe(true);
    expect(shouldStreamBuildJobLog(buildJob, 'build')).toBe(true);
    expect(shouldStreamBuildJobLog(installJob, 'extract')).toBe(false);
    expect(shouldStreamBuildJobLog(finishedInstallJob, 'install')).toBe(false);
  });

  test('requests a single fetch for completed steps even while another build step is still running', () => {
    const finishedExtractStep = createStep({
      key: 'extract',
      status: 'success',
      completedAt: '2026-03-25T08:00:01.000Z',
    });
    const runningBuildStep = createStep({
      key: 'build',
      label: '执行构建',
      status: 'running',
      message: '正在执行构建脚本',
      completedAt: null,
    });
    const job = createJob(runningBuildStep, {
      currentStep: 'build',
      steps: [finishedExtractStep, runningBuildStep],
    });

    expect(resolveBuildJobLogRequest(job, 'extract')).toEqual({
      logStep: 'extract',
      updateMode: 'once',
    });
  });

  test('streams the active build step and polls only non-stream running steps', () => {
    const runningBuildStep = createStep({
      key: 'build',
      label: '执行构建',
      status: 'running',
      message: '正在执行构建脚本',
      completedAt: null,
    });
    const runningNormalizeStep = createStep({
      key: 'normalize',
      label: '规范化资源路径',
      status: 'running',
      message: '正在规范化资源路径',
      completedAt: null,
    });

    expect(resolveBuildJobLogRequest(createJob(runningBuildStep, { currentStep: 'build' }), 'build')).toEqual({
      logStep: 'build',
      updateMode: 'stream',
    });
    expect(resolveBuildJobLogRequest(createJob(runningNormalizeStep, { currentStep: 'normalize' }), 'normalize')).toEqual({
      logStep: 'normalize',
      updateMode: 'poll',
    });
  });

  test('builds session keys from both job and step identifiers', () => {
    expect(getBuildJobTerminalSessionKey(7, 'build')).toBe('7:build');
    expect(getBuildJobTerminalSessionKey(undefined, null)).toBe('no-job:empty');
  });

  test('does not clear history log state before refetching the same job step', () => {
    expect(buildJobLogHookSource).not.toMatch(/let cancelled = false;\s+setHistoryJobLog\(null\);/);
  });

  test('builds structured terminal text for non-process stages', () => {
    const step = createStep({
      key: 'normalize',
      label: '规范化资源路径',
      message: '已自动修正 3 处资源路径',
    });

    const text = buildBuildJobStageText(createJob(step), step);

    expect(text).toContain('阶段: 规范化资源路径');
    expect(text).toContain('状态: success');
    expect(text).toContain('摘要: 已自动修正 3 处资源路径');
    expect(text).toContain('任务: demo / v1.0.0');
  });

  test('includes error details in structured terminal text', () => {
    const step = createStep({
      key: 'validate',
      label: '校验构建产物',
      status: 'failed',
      message: 'dist/index.html 缺失',
      completedAt: '2026-03-25T08:00:04.000Z',
    });

    const text = buildBuildJobStageText(createJob(step, { status: 'failed', errorMessage: 'Build output must contain dist/index.html' }), step);

    expect(text).toContain('状态: failed');
    expect(text).toContain('错误: Build output must contain dist/index.html');
  });

  test('applies realtime snapshot and chunk events into one log payload', () => {
    const initialLog: BuildJobLogItem = {
      step: 'install',
      content: '',
      exists: false,
      updatedAt: null,
    };

    const snapshot = applyBuildJobLogStreamEvent(initialLog, {
      type: 'snapshot',
      step: 'install',
      content: 'Lockfile is up to date\n',
      exists: true,
      updatedAt: '2026-03-25T08:00:02.000Z',
    });
    const next = applyBuildJobLogStreamEvent(snapshot, {
      type: 'chunk',
      step: 'install',
      chunk: 'Packages: +7\n',
      updatedAt: '2026-03-25T08:00:03.000Z',
    });

    expect(snapshot).toEqual({
      step: 'install',
      content: 'Lockfile is up to date\n',
      exists: true,
      updatedAt: '2026-03-25T08:00:02.000Z',
    });
    expect(next).toEqual({
      step: 'install',
      content: 'Lockfile is up to date\nPackages: +7\n',
      exists: true,
      updatedAt: '2026-03-25T08:00:03.000Z',
    });
  });

  test('appends terminal output only when the next content extends the previous content', () => {
    expect(getBuildJobTerminalWrite('Packages: +7\n', 'Packages: +7\nDone in 12s\n', 'Waiting...')).toEqual({
      mode: 'append',
      content: 'Done in 12s\n',
    });
    expect(getBuildJobTerminalWrite('Waiting...', 'Packages: +7\n', 'Waiting...')).toEqual({
      mode: 'replace',
      content: 'Packages: +7\n',
    });
    expect(getBuildJobTerminalWrite('old log', 'fresh snapshot', 'Waiting...')).toEqual({
      mode: 'replace',
      content: 'fresh snapshot',
    });
  });
});
