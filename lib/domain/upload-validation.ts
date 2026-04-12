import path from 'node:path';

const ROOT_ABSOLUTE_HTML_REFERENCE = /\b(src|href)=(["'])(\/(?!\/)[^"']+)\2/gi;
const ROOT_ABSOLUTE_CSS_REFERENCE = /url\(\s*(?:(["'])(\/(?!\/)[^"')]+)\1|(\/(?!\/)[^)"']+))\s*\)/gi;

function isAllowedRootAbsoluteReference(reference: string) {
  return reference.startsWith('/api/') || reference.startsWith('/prototypes/');
}

function toPosixPath(value: string) {
  return value.split(path.sep).join('/');
}

function toRelativePublishedPath(reference: string, fileDirRelativeToDist = '') {
  const fromDir = toPosixPath(fileDirRelativeToDist);
  const targetPath = reference.slice(1);
  const relativePath = path.posix.relative(fromDir || '.', targetPath);

  if (relativePath.startsWith('.')) {
    return relativePath;
  }

  return `./${relativePath}`;
}

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

export function detectForbiddenAbsoluteReferences(content: string) {
  const htmlMatches = [...content.matchAll(ROOT_ABSOLUTE_HTML_REFERENCE)].map((match) => match[3]);
  const cssMatches = [...content.matchAll(ROOT_ABSOLUTE_CSS_REFERENCE)].map((match) => match[2] ?? match[3]);

  return [...htmlMatches, ...cssMatches].filter((value) => value && !isAllowedRootAbsoluteReference(value));
}

export function normalizeForbiddenAbsoluteReferences(content: string, fileDirRelativeToDist = '') {
  let rewrittenCount = 0;

  const normalizedContent = content
    .replace(ROOT_ABSOLUTE_HTML_REFERENCE, (match, attribute, quote, reference) => {
      if (isAllowedRootAbsoluteReference(reference)) {
        return match;
      }

      rewrittenCount += 1;
      return `${attribute}=${quote}${toRelativePublishedPath(reference, fileDirRelativeToDist)}${quote}`;
    })
    .replace(ROOT_ABSOLUTE_CSS_REFERENCE, (match, quoted, quotedReference, unquotedReference) => {
      const reference = quotedReference ?? unquotedReference;
      if (!reference || isAllowedRootAbsoluteReference(reference)) {
        return match;
      }

      rewrittenCount += 1;
      const nextReference = toRelativePublishedPath(reference, fileDirRelativeToDist);
      const quote = quoted ?? '';
      return `url(${quote}${nextReference}${quote})`;
    });

  return {
    content: normalizedContent,
    rewrittenCount,
  };
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
