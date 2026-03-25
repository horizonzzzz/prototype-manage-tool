import { describe, expect, test, vi } from 'vitest';

import {
  publishBuildJobLogChunk,
  publishBuildJobLogStatus,
  resetBuildJobLogStreams,
  subscribeBuildJobLogStream,
} from '@/lib/server/build-job-log-stream';

describe('build job log stream bus', () => {
  test('delivers chunk and status events to subscribers of the same job step only', () => {
    const listener = vi.fn();
    const otherListener = vi.fn();

    const unsubscribe = subscribeBuildJobLogStream(7, 'install', listener);
    subscribeBuildJobLogStream(7, 'build', otherListener);

    publishBuildJobLogChunk(7, 'install', 'Resolving packages...\n');
    publishBuildJobLogStatus(7, 'install', 'success');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'chunk',
      step: 'install',
      chunk: 'Resolving packages...\n',
    }));
    expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'status',
      step: 'install',
      status: 'success',
      done: true,
    }));
    expect(otherListener).not.toHaveBeenCalled();

    unsubscribe();
    resetBuildJobLogStreams();
  });
});
