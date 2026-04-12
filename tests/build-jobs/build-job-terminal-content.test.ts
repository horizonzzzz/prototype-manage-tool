import { describe, expect, test } from 'vitest';

import {
  buildBuildJobStageText,
  resolveActiveBuildJobLogRequest,
  resolveBuildJobTerminalContent,
  shouldDisableBuildJobStepSelection,
  shouldUseBuildJobTerminalEmptyText,
} from '@/lib/ui/build-job-log';
import type { BuildJobItem, BuildJobLogItem, BuildJobStepItem } from '@/lib/types';

function createStep(overrides: Partial<BuildJobStepItem> = {}): BuildJobStepItem {
  return {
    key: 'build',
    label: '执行构建',
    status: 'failed',
    message: '构建失败',
    startedAt: '2026-03-25T08:00:00.000Z',
    completedAt: '2026-03-25T08:00:02.000Z',
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
    status: 'failed',
    currentStep: step.key,
    progressPercent: 100,
    logSummary: '构建失败',
    errorMessage: 'Build failed',
    createdAt: '2026-03-25T08:00:00.000Z',
    startedAt: '2026-03-25T08:00:00.000Z',
    completedAt: '2026-03-25T08:00:02.000Z',
    steps: [step],
    ...overrides,
  };
}

describe('resolveBuildJobTerminalContent', () => {
  test('prefers persisted log content when it exists', () => {
    const step = createStep();
    const job = createJob(step);
    const log: BuildJobLogItem = {
      step: 'build',
      content: 'npm run build\nError: boom\n',
      exists: true,
      updatedAt: '2026-03-25T08:00:02.000Z',
    };

    expect(resolveBuildJobTerminalContent(job, step, log)).toBe(log.content);
  });

  test('falls back to structured stage text when no persisted log exists', () => {
    const step = createStep();
    const job = createJob(step);
    const missingLog: BuildJobLogItem = {
      step: 'build',
      content: '',
      exists: false,
      updatedAt: null,
    };

    expect(resolveBuildJobTerminalContent(job, step, missingLog)).toBe(buildBuildJobStageText(job, step));
  });

  test('ignores stale log content from a different step', () => {
    const buildStep = createStep({
      key: 'build',
      label: '执行构建',
      status: 'running',
      message: '正在执行构建脚本',
      completedAt: null,
    });
    const installStep = createStep({
      key: 'install',
      label: '安装依赖',
      status: 'success',
      message: '依赖安装完成',
      completedAt: '2026-03-25T08:00:01.000Z',
    });
    const job = createJob(buildStep, {
      status: 'running',
      currentStep: 'build',
      progressPercent: 50,
      logSummary: '正在执行构建脚本',
      errorMessage: null,
      completedAt: null,
      steps: [installStep, buildStep],
    });
    const staleLog: BuildJobLogItem = {
      step: 'install',
      content: 'Packages: +42\nDone in 8s\n',
      exists: true,
      updatedAt: '2026-03-25T08:00:01.000Z',
    };

    expect(resolveBuildJobTerminalContent(job, buildStep, staleLog)).toBe('');
    expect(shouldUseBuildJobTerminalEmptyText(job, buildStep, staleLog)).toBe(false);
  });

  test('keeps a running stream step blank until live output arrives', () => {
    const step = createStep({
      status: 'running',
      message: '正在执行构建脚本',
      completedAt: null,
    });
    const job = createJob(step, {
      status: 'running',
      progressPercent: 50,
      logSummary: '正在执行构建脚本',
      errorMessage: null,
      completedAt: null,
    });
    const missingLog: BuildJobLogItem = {
      step: 'build',
      content: '',
      exists: false,
      updatedAt: null,
    };

    expect(resolveBuildJobTerminalContent(job, step, missingLog)).toBe('');
    expect(shouldUseBuildJobTerminalEmptyText(job, step, missingLog)).toBe(false);
  });

  test('derives a stable active log request from stream-driving fields only', () => {
    const runningStep = createStep({
      status: 'running',
      message: '正在执行构建脚本',
      completedAt: null,
    });
    const initialJob = createJob(runningStep, {
      status: 'running',
      progressPercent: 20,
      logSummary: '第一轮状态',
      errorMessage: null,
      completedAt: null,
    });
    const refreshedJob = createJob(runningStep, {
      status: 'running',
      progressPercent: 75,
      logSummary: '第二轮状态',
      errorMessage: null,
      completedAt: null,
      createdAt: '2026-03-25T08:00:03.000Z',
    });

    expect(resolveActiveBuildJobLogRequest(initialJob, null)).toEqual({
      logStep: 'build',
      shouldPoll: false,
      shouldStream: true,
    });
    expect(resolveActiveBuildJobLogRequest(refreshedJob, null)).toEqual(resolveActiveBuildJobLogRequest(initialJob, null));
  });

  test('locks step selection while a job is still running', () => {
    const runningJob = createJob(
      createStep({
        status: 'running',
        message: '正在执行构建脚本',
        completedAt: null,
      }),
      {
        status: 'running',
        completedAt: null,
      },
    );
    const finishedJob = createJob(createStep(), {
      status: 'failed',
    });

    expect(shouldDisableBuildJobStepSelection(runningJob)).toBe(true);
    expect(shouldDisableBuildJobStepSelection(finishedJob)).toBe(false);
    expect(shouldDisableBuildJobStepSelection(null)).toBe(false);
  });
});
