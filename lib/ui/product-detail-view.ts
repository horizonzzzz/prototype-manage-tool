export type VersionAction = 'setDefault' | 'offline';

export type VersionActionContext = {
  status: string;
  isDefault: boolean;
};

type ActiveBuildJob = {
  id: number;
  status: string;
};

export function getVersionStatusMessageKey(status: string): string {
  switch (status) {
    case 'published':
      return 'published';
    case 'queued':
    case 'running':
    case 'building':
      return 'building';
    case 'failed':
      return 'failed';
    case 'offline':
      return 'offline';
    default:
      return status;
  }
}

export function getVersionStatusLabel(status: string): string {
  switch (getVersionStatusMessageKey(status)) {
    case 'published':
      return '已发布';
    case 'building':
      return '构建中';
    case 'failed':
      return '构建失败';
    case 'offline':
      return '已下线';
    default:
      return status;
  }
}

export function isVersionActionEnabled(action: VersionAction, context: VersionActionContext): boolean {
  if (action === 'setDefault') {
    return context.status === 'published' && !context.isDefault;
  }

  if (action === 'offline') {
    return context.status === 'published';
  }

  return false;
}

export function selectActiveBuildJob<T extends ActiveBuildJob>(jobs: T[], activeJobId: number | undefined): T | undefined {
  const runningJob = jobs.find((item) => ['queued', 'running'].includes(item.status));
  if (runningJob) {
    return runningJob;
  }

  if (activeJobId !== undefined) {
    const selectedJob = jobs.find((item) => item.id === activeJobId);
    if (selectedJob) {
      return selectedJob;
    }
  }

  return jobs[0];
}
