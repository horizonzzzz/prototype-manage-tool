import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  readFileMock,
  openMock,
  fromBufferMock,
  closeMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  openMock: vi.fn(),
  fromBufferMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
  },
  readFile: readFileMock,
}));

vi.mock('yauzl', () => ({
  default: {
    open: openMock,
    fromBuffer: fromBufferMock,
  },
}));

import { probeZipArchive } from '@/lib/server/fs-utils';

describe('probeZipArchive fallback path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileMock.mockResolvedValue(Buffer.from('zip-bytes'));
    fromBufferMock.mockImplementation((buffer: Buffer, _options: unknown, callback: (error: Error | null, zip?: { entryCount: number; close: () => void }) => void) => {
      callback(null, {
        entryCount: 7,
        close: closeMock,
      });
    });
  });

  test('falls back to fromBuffer when yauzl.open reports a false zip truncation error', async () => {
    openMock.mockImplementation((_path: string, _options: unknown, callback: (error: Error | null) => void) => {
      callback(new Error('End of central directory record signature not found. Either not a zip file, or file is truncated.'));
    });

    await expect(probeZipArchive('C:/archives/demo.zip')).resolves.toEqual({
      entryCount: 7,
    });

    expect(readFileMock).toHaveBeenCalledWith('C:/archives/demo.zip');
    expect(fromBufferMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test('rethrows the original open error when the buffer fallback also fails', async () => {
    openMock.mockImplementation((_path: string, _options: unknown, callback: (error: Error | null) => void) => {
      callback(new Error('End of central directory record signature not found. Either not a zip file, or file is truncated.'));
    });
    fromBufferMock.mockImplementation((_buffer: Buffer, _options: unknown, callback: (error: Error | null) => void) => {
      callback(new Error('fallback open failed'));
    });

    await expect(probeZipArchive('C:/archives/demo.zip')).rejects.toThrow(/End of central directory record signature not found/i);
  });
});
