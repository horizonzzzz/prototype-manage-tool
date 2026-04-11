'use client';

import { useEffect, useState } from 'react';

import type { BuildJobItem, BuildJobLogItem, BuildJobLogStreamEvent, BuildJobStepItem, BuildJobStepKey } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import {
  applyBuildJobLogStreamEvent,
  buildBuildJobLogStreamUrl,
  getBuildJobLogStep,
  isBuildJobLogStreamStep,
  shouldStreamBuildJobLog,
} from '@/lib/ui/build-job-log';

export function useActiveBuildJobLog(
  activeJobId: number | undefined,
  activeJob: BuildJobItem | null,
  selectedLogStepKey: BuildJobStepKey | null,
): BuildJobLogItem | null {
  const [activeJobLog, setActiveJobLog] = useState<BuildJobLogItem | null>(null);

  useEffect(() => {
    if (!activeJobId || !activeJob) {
      setActiveJobLog(null);
      return;
    }

    const nextLogStep = selectedLogStepKey ? getBuildJobLogStep(selectedLogStepKey) : getBuildJobLogStep(activeJob.currentStep);
    if (!nextLogStep) {
      setActiveJobLog(null);
      return;
    }
    const currentJobId = activeJobId;
    const logStep = nextLogStep;

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;

    async function loadLog(): Promise<void> {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${currentJobId}/logs?step=${logStep}`);
        if (!cancelled) {
          setActiveJobLog(payload);
        }
      } catch {
        if (!cancelled) {
          setActiveJobLog({ step: logStep, content: '', exists: false, updatedAt: null });
        }
      }
    }

    if (shouldStreamBuildJobLog(activeJob, logStep) && isBuildJobLogStreamStep(logStep) && typeof EventSource !== 'undefined') {
      const streamStep = logStep;

      async function connectStream(): Promise<void> {
        await loadLog();
        if (cancelled) {
          return;
        }

        eventSource = new EventSource(buildBuildJobLogStreamUrl(currentJobId, streamStep));
        const handleStreamEvent = (messageEvent: MessageEvent<string>) => {
          if (cancelled) {
            return;
          }

          const event = JSON.parse(messageEvent.data) as BuildJobLogStreamEvent;
          setActiveJobLog((current) => applyBuildJobLogStreamEvent(current, event));
          if (event.type === 'status' && event.done) {
            eventSource?.close();
            eventSource = null;
          }
        };

        eventSource.addEventListener('snapshot', handleStreamEvent as EventListener);
        eventSource.addEventListener('chunk', handleStreamEvent as EventListener);
        eventSource.addEventListener('status', handleStreamEvent as EventListener);
        eventSource.addEventListener('heartbeat', handleStreamEvent as EventListener);
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      }

      void connectStream();

      return () => {
        cancelled = true;
        eventSource?.close();
      };
    }

    void loadLog();
    if (['queued', 'running'].includes(activeJob.status)) {
      timer = window.setInterval(() => void loadLog(), 1500);
    }

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      eventSource?.close();
    };
  }, [activeJob, activeJobId, selectedLogStepKey]);

  return activeJobLog;
}

export function useHistoryBuildJobLog(
  historyDrawerOpen: boolean,
  historyActiveJob: BuildJobItem | null,
  historySelectedStep: BuildJobStepItem | null,
): BuildJobLogItem | null {
  const [historyJobLog, setHistoryJobLog] = useState<BuildJobLogItem | null>(null);

  useEffect(() => {
    if (!historyDrawerOpen || !historyActiveJob || !historySelectedStep) {
      setHistoryJobLog(null);
      return;
    }

    const nextLogStep = getBuildJobLogStep(historySelectedStep.key);
    if (!nextLogStep) {
      setHistoryJobLog(null);
      return;
    }
    const historyJobId = historyActiveJob.id;
    const logStep = nextLogStep;

    let cancelled = false;
    setHistoryJobLog(null);

    async function loadHistoryLog(): Promise<void> {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${historyJobId}/logs?step=${logStep}`);
        if (!cancelled) {
          setHistoryJobLog(payload);
        }
      } catch {
        if (!cancelled) {
          setHistoryJobLog({ step: logStep, content: '', exists: false, updatedAt: null });
        }
      }
    }

    void loadHistoryLog();

    return () => {
      cancelled = true;
    };
  }, [historyActiveJob, historyDrawerOpen, historySelectedStep]);

  return historyJobLog;
}
