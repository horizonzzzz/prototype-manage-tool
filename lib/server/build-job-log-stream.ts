import type {
  BuildJobLogItem,
  BuildJobLogStreamEvent,
  BuildJobLogStreamSnapshotEvent,
  BuildJobLogStreamStatusEvent,
  BuildJobLogStreamStep,
} from '@/lib/types';

type StreamListener = (event: BuildJobLogStreamEvent) => void;

type StreamChannel = {
  listeners: Set<StreamListener>;
};

type StreamState = {
  channels: Map<string, StreamChannel>;
};

const globalStreamState = globalThis as typeof globalThis & {
  __buildJobLogStreamState__?: StreamState;
};

function getStreamState() {
  if (!globalStreamState.__buildJobLogStreamState__) {
    globalStreamState.__buildJobLogStreamState__ = {
      channels: new Map<string, StreamChannel>(),
    };
  }

  return globalStreamState.__buildJobLogStreamState__;
}

function getChannelKey(jobId: number, step: BuildJobLogStreamStep) {
  return `${jobId}:${step}`;
}

function getOrCreateChannel(jobId: number, step: BuildJobLogStreamStep) {
  const state = getStreamState();
  const key = getChannelKey(jobId, step);
  let channel = state.channels.get(key);

  if (!channel) {
    channel = {
      listeners: new Set<StreamListener>(),
    };
    state.channels.set(key, channel);
  }

  return channel;
}

function publishEvent(jobId: number, step: BuildJobLogStreamStep, event: BuildJobLogStreamEvent) {
  const state = getStreamState();
  const key = getChannelKey(jobId, step);
  const channel = state.channels.get(key);
  if (!channel) {
    return;
  }

  for (const listener of [...channel.listeners]) {
    listener(event);
  }

  if (channel.listeners.size === 0) {
    state.channels.delete(key);
  }
}

function encodeSseEvent(event: BuildJobLogStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function subscribeBuildJobLogStream(jobId: number, step: BuildJobLogStreamStep, listener: StreamListener) {
  const channel = getOrCreateChannel(jobId, step);
  channel.listeners.add(listener);

  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size === 0) {
      getStreamState().channels.delete(getChannelKey(jobId, step));
    }
  };
}

export function publishBuildJobLogChunk(jobId: number, step: BuildJobLogStreamStep, chunk: string) {
  publishEvent(jobId, step, {
    type: 'chunk',
    step,
    chunk,
    updatedAt: new Date().toISOString(),
  });
}

export function publishBuildJobLogStatus(
  jobId: number,
  step: BuildJobLogStreamStep,
  status: BuildJobLogStreamStatusEvent['status'],
  message?: string,
) {
  publishEvent(jobId, step, {
    type: 'status',
    step,
    status,
    done: true,
    message,
    updatedAt: new Date().toISOString(),
  });
}

export function createBuildJobLogStreamResponse(
  jobId: number,
  step: BuildJobLogStreamStep,
  signal: AbortSignal | undefined,
  snapshot: BuildJobLogItem,
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        let closed = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let unsubscribe: () => void = () => {};

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;
          if (heartbeat) {
            clearInterval(heartbeat);
          }
          unsubscribe();
          signal?.removeEventListener('abort', close);
          try {
            controller.close();
          } catch {
            // Ignore duplicate close attempts when the client disconnects.
          }
        };

        const send = (event: BuildJobLogStreamEvent) => {
          if (closed) {
            return;
          }

          controller.enqueue(encoder.encode(encodeSseEvent(event)));
          if (event.type === 'status' && event.done) {
            close();
          }
        };

        const snapshotEvent: BuildJobLogStreamSnapshotEvent = {
          type: 'snapshot',
          step,
          content: snapshot.content,
          exists: snapshot.exists,
          updatedAt: snapshot.updatedAt,
        };
        send(snapshotEvent);

        unsubscribe = subscribeBuildJobLogStream(jobId, step, send);
        heartbeat = setInterval(() => {
          send({
            type: 'heartbeat',
            step,
            updatedAt: new Date().toISOString(),
          });
        }, 15000);

        signal?.addEventListener('abort', close, { once: true });
      },
    }),
    {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    },
  );
}

export function resetBuildJobLogStreams() {
  getStreamState().channels.clear();
}
