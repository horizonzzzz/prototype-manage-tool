import type {
  BuildJobItem,
  BuildJobLogItem,
  BuildJobLogStep,
  BuildJobLogStreamEvent,
  BuildJobLogStreamStep,
  BuildJobStepItem,
} from '@/lib/types';

const BUILD_JOB_LOG_STEPS = ['extract', 'install', 'build', 'normalize', 'validate', 'publish'] as const satisfies readonly BuildJobLogStep[];
const BUILD_JOB_LOG_STREAM_STEPS = ['install', 'build'] as const satisfies readonly BuildJobLogStreamStep[];

export function isBuildJobLogStep(step: string | null | undefined): step is BuildJobLogStep {
  return Boolean(step && BUILD_JOB_LOG_STEPS.includes(step as BuildJobLogStep));
}

export function getBuildJobLogStep(step: string | null | undefined): BuildJobLogStep | null {
  return isBuildJobLogStep(step) ? step : null;
}

export function isBuildJobLogStreamStep(step: string | null | undefined): step is BuildJobLogStreamStep {
  return Boolean(step && BUILD_JOB_LOG_STREAM_STEPS.includes(step as BuildJobLogStreamStep));
}

export function shouldStreamBuildJobLog(job: BuildJobItem | null | undefined, step: string | null | undefined) {
  if (!job || !isBuildJobLogStreamStep(step) || !['queued', 'running'].includes(job.status)) {
    return false;
  }

  return job.steps.some((item) => item.key === step && item.status === 'running');
}

export function buildBuildJobLogStreamUrl(jobId: number, step: BuildJobLogStreamStep) {
  return `/api/build-jobs/${jobId}/logs/stream?step=${step}`;
}

export function applyBuildJobLogStreamEvent(current: BuildJobLogItem | null, event: BuildJobLogStreamEvent): BuildJobLogItem {
  switch (event.type) {
    case 'snapshot':
      return {
        step: event.step,
        content: event.content,
        exists: event.exists,
        updatedAt: event.updatedAt,
      };
    case 'chunk':
      return {
        step: event.step,
        content: `${current?.content ?? ''}${event.chunk}`,
        exists: true,
        updatedAt: event.updatedAt,
      };
    case 'status':
    case 'heartbeat':
      return {
        step: event.step,
        content: current?.content ?? '',
        exists: current?.exists ?? false,
        updatedAt: event.updatedAt,
      };
  }
}

export function getBuildJobTerminalWrite(previousContent: string, nextContent: string, emptyText: string) {
  const previous = previousContent || emptyText;
  const next = nextContent || emptyText;

  if (
    previous !== emptyText &&
    next !== emptyText &&
    next.length > previous.length &&
    next.startsWith(previous)
  ) {
    return {
      mode: 'append' as const,
      content: next.slice(previous.length),
    };
  }

  return {
    mode: 'replace' as const,
    content: next,
  };
}

function formatStageTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return value.replace('T', ' ').replace('.000Z', 'Z');
}

export function buildBuildJobStageText(job: BuildJobItem, step: BuildJobStepItem) {
  const lines = [
    `任务: ${job.productKey} / ${job.version}`,
    `阶段: ${step.label}`,
    `状态: ${step.status}`,
    `开始: ${formatStageTime(step.startedAt)}`,
    `结束: ${formatStageTime(step.completedAt)}`,
    `摘要: ${step.message || job.logSummary || '无'}`,
  ];

  if (job.errorMessage && step.status === 'failed') {
    lines.push(`错误: ${job.errorMessage}`);
  }

  return lines.join('\r\n');
}
