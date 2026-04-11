'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/domain/error-message';
import type { BuildJobItem, ProductDetail } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import { selectActiveBuildJob } from '@/lib/ui/product-detail-view';

type UseProductDetailStateResult = {
  activeJob: BuildJobItem | null;
  activeJobId: number | undefined;
  jobs: BuildJobItem[];
  loading: boolean;
  productDetail: ProductDetail | null;
  productMissing: boolean;
  activateJob: (job: BuildJobItem) => void;
  refreshCurrent: () => Promise<void>;
};

export function useProductDetailState(productKey: string): UseProductDetailStateResult {
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [jobs, setJobs] = useState<BuildJobItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<number>();
  const [activeJob, setActiveJob] = useState<BuildJobItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [productMissing, setProductMissing] = useState(false);

  function clearProductContext(): void {
    setProductDetail(null);
    setJobs([]);
    setActiveJobId(undefined);
    setActiveJob(null);
    setProductMissing(false);
  }

  function syncJobs(nextJobs: BuildJobItem[]): void {
    setJobs(nextJobs);
    const nextActive = selectActiveBuildJob(nextJobs, activeJobId);

    setActiveJobId(nextActive?.id);
    setActiveJob(nextActive ?? null);
  }

  async function loadProductDetail(targetProductKey: string): Promise<void> {
    setLoading(true);

    try {
      const [detail, buildJobs] = await Promise.all([
        fetchJson<ProductDetail>(`/api/products/${targetProductKey}`),
        fetchJson<BuildJobItem[]>(`/api/products/${targetProductKey}/build-jobs`),
      ]);

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

    await loadProductDetail(productKey);
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
      const message = getErrorMessage(error, '加载产品详情失败');
      setProductDetail(null);
      syncJobs([]);
      setProductMissing(true);
      if (message !== 'Product not found') {
        toast.error(message);
      }
    });
  }, [productKey]);

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
    loading,
    productDetail,
    productMissing,
    activateJob,
    refreshCurrent,
  };
}
