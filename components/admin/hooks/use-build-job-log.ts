'use client';

import { useEffect, useRef, useState } from 'react';

import type { BuildJobItem, BuildJobLogItem, BuildJobLogStreamEvent, BuildJobStepItem, BuildJobStepKey } from '@/lib/types';
import { fetchJson } from '@/lib/ui/api-client';
import {
  applyBuildJobLogStreamEvent,
  buildBuildJobLogStreamUrl,
  getBuildJobTerminalSessionKey,
  mergeBuildJobLogSnapshot,
  resolveBuildJobLogRequest,
  resolveActiveBuildJobLogRequest,
} from '@/lib/ui/build-job-log';

export function useActiveBuildJobLog(
  activeJobId: number | undefined,
  activeJob: BuildJobItem | null,
  selectedLogStepKey: BuildJobStepKey | null,
): BuildJobLogItem | null {
  const [activeJobLog, setActiveJobLog] = useState<BuildJobLogItem | null>(null);
  const activeSessionKeyRef = useRef<string | null>(null);
  const logRequest = resolveActiveBuildJobLogRequest(activeJob, selectedLogStepKey);
  const logStep = logRequest?.logStep;
  const shouldPoll = logRequest?.shouldPoll ?? false;
  const shouldStream = logRequest?.shouldStream ?? false;

  useEffect(() => {
    if (!activeJobId || !logStep) {
      setActiveJobLog(null);
      activeSessionKeyRef.current = null;
      return;
    }
    const currentJobId = activeJobId;
    const currentLogStep = logStep;
    const currentSessionKey = getBuildJobTerminalSessionKey(currentJobId, currentLogStep);

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;

    if (activeSessionKeyRef.current !== currentSessionKey) {
      activeSessionKeyRef.current = currentSessionKey;
      setActiveJobLog(null);
    }

    async function loadLog(): Promise<void> {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${currentJobId}/logs?step=${currentLogStep}`);
        if (!cancelled) {
          setActiveJobLog((current) => mergeBuildJobLogSnapshot(current, payload));
        }
      } catch {
        if (!cancelled) {
          setActiveJobLog((current) =>
            current?.step === currentLogStep ? current : { step: currentLogStep, content: '', exists: false, updatedAt: null },
          );
        }
      }
    }

    if (shouldStream && typeof EventSource !== 'undefined') {
      const streamStep = currentLogStep as 'install' | 'build';

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
      }

      void connectStream();

      return () => {
        cancelled = true;
        eventSource?.close();
      };
    }

    void loadLog();
    if (shouldPoll) {
      timer = window.setInterval(() => void loadLog(), 1500);
    }

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      eventSource?.close();
    };
  }, [activeJobId, logStep, shouldPoll, shouldStream]);

  return activeJobLog;
}

export function useHistoryBuildJobLog(
  historyDrawerOpen: boolean,
  historyActiveJob: BuildJobItem | null,
  historySelectedStep: BuildJobStepItem | null,
): BuildJobLogItem | null {
  const [historyJobLog, setHistoryJobLog] = useState<BuildJobLogItem | null>(null);
  const historySessionKeyRef = useRef<string | null>(null);
  const historyLogRequest = resolveBuildJobLogRequest(historyActiveJob, historySelectedStep?.key ?? null);
  const historyLogStep = historyLogRequest?.logStep;
  const historyUpdateMode = historyLogRequest?.updateMode;
  const historyJobId = historyActiveJob?.id;

  useEffect(() => {
    if (!historyDrawerOpen || !historyJobId || !historyLogStep) {
      setHistoryJobLog(null);
      historySessionKeyRef.current = null;
      return;
    }
    const currentHistoryJobId = historyJobId;
    const logStep = historyLogStep;
    const currentSessionKey = getBuildJobTerminalSessionKey(currentHistoryJobId, logStep);

    let cancelled = false;
    let timer: number | null = null;
    let eventSource: EventSource | null = null;

    if (historySessionKeyRef.current !== currentSessionKey) {
      historySessionKeyRef.current = currentSessionKey;
      setHistoryJobLog(null);
    }

    async function loadHistoryLog(): Promise<void> {
      try {
        const payload = await fetchJson<BuildJobLogItem>(`/api/build-jobs/${currentHistoryJobId}/logs?step=${logStep}`);
        if (!cancelled) {
          setHistoryJobLog((current) => mergeBuildJobLogSnapshot(current, payload));
        }
      } catch {
        if (!cancelled) {
          setHistoryJobLog((current) => current ?? { step: logStep, content: '', exists: false, updatedAt: null });
        }
      }
    }

    if (historyUpdateMode === 'stream' && typeof EventSource !== 'undefined') {
      const streamStep = logStep as 'install' | 'build';

      async function connectStream(): Promise<void> {
        await loadHistoryLog();
        if (cancelled) {
          return;
        }

        eventSource = new EventSource(buildBuildJobLogStreamUrl(currentHistoryJobId, streamStep));
        const handleStreamEvent = (messageEvent: MessageEvent<string>) => {
          if (cancelled) {
            return;
          }

          const event = JSON.parse(messageEvent.data) as BuildJobLogStreamEvent;
          setHistoryJobLog((current) => applyBuildJobLogStreamEvent(current, event));
          if (event.type === 'status' && event.done) {
            eventSource?.close();
            eventSource = null;
          }
        };

        eventSource.addEventListener('snapshot', handleStreamEvent as EventListener);
        eventSource.addEventListener('chunk', handleStreamEvent as EventListener);
        eventSource.addEventListener('status', handleStreamEvent as EventListener);
        eventSource.addEventListener('heartbeat', handleStreamEvent as EventListener);
      }

      void connectStream();

      return () => {
        cancelled = true;
        eventSource?.close();
      };
    }

    void loadHistoryLog();
    if (historyUpdateMode === 'poll') {
      timer = window.setInterval(() => void loadHistoryLog(), 1500);
    }

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
      eventSource?.close();
    };
  }, [historyDrawerOpen, historyJobId, historyLogStep, historyUpdateMode]);

  return historyJobLog;
}
