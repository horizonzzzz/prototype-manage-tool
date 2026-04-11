'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { BuildJobItem, ProductDetail } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import { resolveProductDetailLoadFailure } from '@/lib/ui/product-detail-load-state';
import { selectActiveBuildJob } from '@/lib/ui/product-detail-view';

type UseProductDetailStateResult = {
  activeJob: BuildJobItem | null;
  activeJobId: number | undefined;
  jobs: BuildJobItem[];
  loadError: string | null;
  loading: boolean;
  productDetail: ProductDetail | null;
  productMissing: boolean;
  activateJob: (job: BuildJobItem) => void;
  refreshCurrent: () => Promise<void>;
};

export function useProductDetailState(productKey: string, loadErrorFallback = 'Failed to load product detail'): UseProductDetailStateResult {
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productMissing, setProductMissing] = useState(false);

  function clearProductContext(): void {
    setProductDetail(null);
    setJobs([]);
    setActiveJobId(undefined);
    setActiveJob(null);
    setLoadError(null);
    setProductMissing(false);
  }

  function syncJobs(nextJobs: BuildJobItem[]): void {
    setJobs(nextJobs);
    const nextActive = selectActiveBuildJob(nextJobs, activeJobId);

    setActiveJobId(nextActive?.id);
    setActiveJob(nextActive ?? null);
  }

  function handleLoadFailure(error: unknown) {
    const { message, productMissing } = resolveProductDetailLoadFailure(error, loadErrorFallback);

    if (productMissing) {
      setProductDetail(null);
      syncJobs([]);
      setLoadError(null);
      setProductMissing(true);
      return { message, productMissing };
    }

    setLoadError(message);
    setProductMissing(false);
    return { message, productMissing };
  }

  async function loadProductDetail(targetProductKey: string): Promise<void> {
    setLoading(true);
    setLoadError(null);

    try {
      const detail = await fetchJson<ProductDetail>(`/api/products/${targetProductKey}`);
      const buildJobs = await fetchJson<BuildJobItem[]>(`/api/products/${targetProductKey}/build-jobs`);

      setProductDetail(detail);
      syncJobs(buildJobs);
      setProductMissing(false);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrent(): Promise<void> {
    if (!productKey) {
      return;
    }

    try {
      await loadProductDetail(productKey);
    } catch (error) {
      handleLoadFailure(error);
      throw error;
    }
  }

  function activateJob(job: BuildJobItem): void {
    setActiveJobId(job.id);
    setActiveJob(job);
  }

  useEffect(() => {
    if (!productKey) {
      clearProductContext();
      return;
    }

    void loadProductDetail(productKey).catch((error) => {
      const failure = handleLoadFailure(error);
      if (!failure.productMissing) {
        toast.error(failure.message);
      }
    });
  }, [loadErrorFallback, productKey]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const job = await fetchJson<BuildJobItem>(`/api/build-jobs/${activeJobId}`);
        if (cancelled) {
          return;
        }

        setActiveJob(job);
        setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));

        if (!['queued', 'running'].includes(job.status)) {
          window.clearInterval(timer);
          if (productKey === job.productKey) {
            await loadProductDetail(job.productKey);
          }
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, productKey]);

  return {
    activeJob,
    activeJobId,
    jobs,
    loadError,
    loading,
    productDetail,
    productMissing,
    activateJob,
    refreshCurrent,
  };
}
