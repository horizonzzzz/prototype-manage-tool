const ROOT_ABSOLUTE_REFERENCE = /\b(?:src|href)=["'](\/(?!\/)[^"']+)["']/gi;

export function normalizeUploadFileName(fileName: string) {
  const normalized = fileName.trim();

  if (
    !normalized.toLowerCase().endsWith('.zip') ||
    normalized.includes('..') ||
    normalized.includes('/') ||
    normalized.includes('\\')
  ) {
    throw new Error('Only zip files are allowed');
  }

  return normalized;
}

export function detectForbiddenAbsoluteReferences(indexHtml: string) {
  const matches = [...indexHtml.matchAll(ROOT_ABSOLUTE_REFERENCE)];

  return matches
    .map((match) => match[1])
    .filter((value) => !value.startsWith('/api/') && !value.startsWith('/prototypes/'));
}

type UploadEventLike = {
  file?: {
    originFileObj?: File | Blob | object;
  };
  fileList?: Array<{
    originFileObj?: File | Blob | object;
  }>;
};

export function extractUploadFileFromEvent(event?: UploadEventLike | null) {
  if (!event) {
    return undefined;
  }

  if (event.file?.originFileObj) {
    return event.file.originFileObj;
  }

  const latestFile = event.fileList?.[event.fileList.length - 1];
  return latestFile?.originFileObj;
}
