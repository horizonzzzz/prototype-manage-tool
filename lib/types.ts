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
  errorMessage: string | null;
  createdAt: string;
};

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
  defaultVersion: string | null;
  versions: ProductVersionManifest[];
  createdAt: string;
};

