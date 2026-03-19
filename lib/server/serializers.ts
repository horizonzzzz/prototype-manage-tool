import type { Product, ProductVersion, UploadRecord } from '@prisma/client';

import { getCurrentJobStep, getJobProgressPercent, parseJobSteps } from '@/lib/domain/build-job';
import type { ManifestProduct, ProductDetail, ProductListItem, ProductVersionItem, UploadRecordItem } from '@/lib/types';

export function serializeVersion(version: ProductVersion, latestVersionValue?: string): ProductVersionItem {
  return {
    id: version.id,
    version: version.version,
    title: version.title,
    remark: version.remark,
    entryUrl: version.entryUrl,
    status: version.status,
    isDefault: version.isDefault,
    isLatest: version.version === latestVersionValue,
    createdAt: version.createdAt.toISOString(),
  };
}

export function serializeProductListItem(product: Product & { versions: ProductVersion[] }): ProductListItem {
  return {
    id: product.id,
    key: product.key,
    name: product.name,
    description: product.description,
    createdAt: product.createdAt.toISOString(),
    publishedCount: product.versions.filter((item) => item.status === 'published').length,
  };
}

export function serializeProductDetail(product: Product & { versions: ProductVersion[] }): ProductDetail {
  const latestVersionValue = [...product.versions].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0]?.version;

  return {
    ...serializeProductListItem(product),
    versions: [...product.versions]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((version) => serializeVersion(version, latestVersionValue)),
  };
}

export function serializeUploadRecord(record: UploadRecord): UploadRecordItem {
  const steps = parseJobSteps(record.stepsJson);
  const currentStep = getCurrentJobStep(steps);

  return {
    id: record.id,
    productKey: record.productKey,
    version: record.version,
    fileName: record.fileName,
    fileSize: record.fileSize,
    status: record.status,
    currentStep: record.currentStep ?? currentStep?.key ?? null,
    progressPercent: getJobProgressPercent(steps),
    logSummary: record.logSummary,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    steps,
  };
}

export function serializeManifestProduct(product: Product & { versions: ProductVersion[] }): ManifestProduct {
  const publishedVersions = product.versions
    .filter((item) => item.status === 'published')
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const latestVersion = publishedVersions[0]?.version;

  return {
    key: product.key,
    name: product.name,
    defaultVersion: publishedVersions.find((item) => item.isDefault)?.version ?? latestVersion ?? null,
    createdAt: product.createdAt.toISOString(),
    versions: publishedVersions.map((item) => ({
      version: item.version,
      title: item.title,
      remark: item.remark,
      entryUrl: item.entryUrl,
      createdAt: item.createdAt.toISOString(),
      isDefault: item.isDefault,
      isLatest: item.version === latestVersion,
    })),
  };
}
