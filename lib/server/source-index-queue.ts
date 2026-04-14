import { prisma } from '@/lib/prisma';
import { rebuildSourceSnapshotIndex } from '@/lib/server/source-index-builder';

type SourceIndexQueueState = {
  queue: number[];
  active: Set<number>;
  draining: boolean;
};

type SourceIndexBackfillState = {
  status: 'idle' | 'running' | 'completed';
  promise: Promise<void> | null;
};

let queueState: SourceIndexQueueState | undefined;
let backfillState: SourceIndexBackfillState | undefined;

function getSourceIndexQueueState(): SourceIndexQueueState {
  if (!queueState) {
    queueState = {
      queue: [],
      active: new Set<number>(),
      draining: false,
    };
  }

  return queueState;
}

function getSourceIndexBackfillState(): SourceIndexBackfillState {
  if (!backfillState) {
    backfillState = {
      status: 'idle',
      promise: null,
    };
  }

  return backfillState;
}

async function drainSourceIndexQueue() {
  const state = getSourceIndexQueueState();
  if (state.draining) {
    return;
  }

  state.draining = true;
  try {
    while (state.queue.length > 0) {
      const versionId = state.queue.shift();
      if (!versionId || state.active.has(versionId)) {
        continue;
      }

      state.active.add(versionId);
      try {
        await rebuildSourceSnapshotIndex(versionId);
      } catch {
        // Failures are persisted by rebuildSourceSnapshotIndex and retried by backfill.
      } finally {
        state.active.delete(versionId);
      }
    }
  } finally {
    state.draining = false;
  }
}

export function scheduleSourceSnapshotIndexBuild(versionId: number) {
  const state = getSourceIndexQueueState();
  if (state.active.has(versionId) || state.queue.includes(versionId)) {
    return;
  }

  state.queue.push(versionId);
  setTimeout(() => {
    void drainSourceIndexQueue();
  }, 0);
}

/** Reset queue and backfill state. Exported for test isolation only. */
export function __resetSourceIndexQueueState() {
  queueState = undefined;
  backfillState = undefined;
}

export async function ensureSourceIndexBackfillScheduled() {
  const state = getSourceIndexBackfillState();
  if (state.status === 'completed') {
    return;
  }

  if (!state.promise) {
    state.status = 'running';
    state.promise = (async () => {
      try {
        const snapshots = await prisma.sourceSnapshot.findMany({
          where: {
            status: 'ready',
            indexStatus: {
              in: ['pending', 'failed'],
            },
            version: {
              status: 'published',
            },
          },
          select: {
            versionId: true,
          },
          orderBy: {
            versionId: 'asc',
          },
        });

        for (const snapshot of snapshots) {
          scheduleSourceSnapshotIndexBuild(snapshot.versionId);
        }

        state.status = 'completed';
      } catch {
        state.status = 'idle';
      } finally {
        state.promise = null;
      }
    })();
  }

  await state.promise;
}
