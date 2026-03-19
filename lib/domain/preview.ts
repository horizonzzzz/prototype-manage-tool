type PreviewVersion = {
  version: string;
  isDefault: boolean;
  createdAt: Date;
};

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

