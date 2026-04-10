export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export type ProductVersionItem = {
  id: number;
  version: string;
  title: string | null;
  remark: string | null;
  entryUrl: string;
  status: string;
  isDefault: boolean;
  isLatest: boolean;
  downloadable: boolean;
  createdAt: string;
};

export type ProductListItem = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  publishedCount: number;
};

export type ProductDetail = ProductListItem & {
  versions: ProductVersionItem[];
};

export type UploadRecordItem = {
  id: number;
  productKey: string;
  version: string;
  fileName: string;
  fileSize: number;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  logSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: BuildJobStepItem[];
};

export type BuildJobStepKey = 'extract' | 'install' | 'build' | 'normalize' | 'validate' | 'publish';

export type BuildJobStepItem = {
  key: BuildJobStepKey;
  label: string;
  status: string;
  message: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type BuildJobItem = {
  id: number;
  productKey: string;
  version: string;
  fileName: string;
  fileSize: number;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  logSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: BuildJobStepItem[];
};

export type BuildJobListItem = BuildJobItem;

export type BuildJobLogStep = BuildJobStepKey;

export type BuildJobLogItem = {
  step: BuildJobLogStep;
  content: string;
  exists: boolean;
  updatedAt: string | null;
};

export type BuildJobLogStreamStep = Extract<BuildJobLogStep, 'install' | 'build'>;

export type BuildJobLogStreamSnapshotEvent = {
  type: 'snapshot';
  step: BuildJobLogStreamStep;
  content: string;
  exists: boolean;
  updatedAt: string | null;
};

export type BuildJobLogStreamChunkEvent = {
  type: 'chunk';
  step: BuildJobLogStreamStep;
  chunk: string;
  updatedAt: string;
};

export type BuildJobLogStreamStatusEvent = {
  type: 'status';
  step: BuildJobLogStreamStep;
  status: 'success' | 'failed';
  done: true;
  message?: string;
  updatedAt: string;
};

export type BuildJobLogStreamHeartbeatEvent = {
  type: 'heartbeat';
  step: BuildJobLogStreamStep;
  updatedAt: string;
};

export type BuildJobLogStreamEvent =
  | BuildJobLogStreamSnapshotEvent
  | BuildJobLogStreamChunkEvent
  | BuildJobLogStreamStatusEvent
  | BuildJobLogStreamHeartbeatEvent;

export type ProductVersionManifest = {
  version: string;
  title: string | null;
  remark: string | null;
  entryUrl: string;
  createdAt: string;
  isDefault: boolean;
  isLatest: boolean;
};

export type ManifestProduct = {
  key: string;
  name: string;
  description: string | null;
  defaultVersion: string | null;
  versions: ProductVersionManifest[];
  createdAt: string;
};
