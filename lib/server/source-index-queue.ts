import { prisma } from '@/lib/prisma';
import { rebuildSourceSnapshotIndex } from '@/lib/server/source-index-builder';

type SourceIndexQueueState = {
  queue: number[];
  active: Set<number>;
  draining: boolean;
};

type SourceIndexBackfillState = {
  promise: Promise<void> | null;
  lastRunAt: number | null;
};

const SOURCE_INDEX_BACKFILL_RESCAN_INTERVAL_MS = 30_000;

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
      promise: null,
      lastRunAt: null,
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
  if (state.promise) {
    await state.promise;
    return;
  }

  const now = Date.now();
  if (state.lastRunAt !== null && now - state.lastRunAt < SOURCE_INDEX_BACKFILL_RESCAN_INTERVAL_MS) {
    return;
  }

  state.lastRunAt = now;
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
    } finally {
      state.promise = null;
    }
  })();

  await state.promise;
}
