type PreviewVersion = {
  version: string;
  isDefault: boolean;
  createdAt: Date;
};

type PreviewVersionWithBadges = {
  version: string;
  isDefault: boolean;
  isLatest?: boolean;
};

type PreviewVersionGroup<T extends PreviewVersionWithBadges> = {
  visibleVersions: T[];
  overflowVersions: T[];
};

export const DEFAULT_PREVIEW_VISIBLE_VERSION_COUNT = 4;

export function pickVersionForPreview(versions: PreviewVersion[], requestedVersion?: string) {
  if (requestedVersion) {
    const directMatch = versions.find((item) => item.version === requestedVersion);
    if (directMatch) {
      return directMatch;
    }
  }

  const defaultVersion = versions.find((item) => item.isDefault);
  if (defaultVersion) {
    return defaultVersion;
  }

  return [...versions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

export function groupVersionsForPreview<T extends PreviewVersionWithBadges>(
  versions: T[],
  currentVersion?: string,
  maxVisible = DEFAULT_PREVIEW_VISIBLE_VERSION_COUNT,
): PreviewVersionGroup<T> {
  const visibleLimit = Math.max(0, maxVisible);
  if (visibleLimit === 0) {
    return {
      visibleVersions: [],
      overflowVersions: [...versions],
    };
  }

  if (versions.length <= visibleLimit) {
    return {
      visibleVersions: [...versions],
      overflowVersions: [],
    };
  }

  const prioritizedVersions = new Set<string>();
  const defaultVersion = versions.find((item) => item.isDefault);
  const latestVersion = versions.find((item) => item.isLatest);
  const currentVersionItem = currentVersion ? versions.find((item) => item.version === currentVersion) : undefined;

  if (defaultVersion) {
    prioritizedVersions.add(defaultVersion.version);
  }
  if (latestVersion) {
    prioritizedVersions.add(latestVersion.version);
  }
  if (currentVersionItem) {
    prioritizedVersions.add(currentVersionItem.version);
  }

  const visibleKeys = new Set<string>();

  for (const item of versions) {
    if (visibleKeys.size >= visibleLimit) {
      break;
    }

    if (!prioritizedVersions.has(item.version) || visibleKeys.has(item.version)) {
      continue;
    }

    visibleKeys.add(item.version);
  }

  for (const item of versions) {
    if (visibleKeys.size >= visibleLimit) {
      break;
    }

    if (visibleKeys.has(item.version)) {
      continue;
    }

    visibleKeys.add(item.version);
  }

  return {
    visibleVersions: versions.filter((item) => visibleKeys.has(item.version)),
    overflowVersions: versions.filter((item) => !visibleKeys.has(item.version)),
  };
}
