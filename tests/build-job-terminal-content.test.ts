import { describe, expect, test } from 'vitest';

import { buildBuildJobStageText, resolveBuildJobTerminalContent } from '@/lib/ui/build-job-log';
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
});
