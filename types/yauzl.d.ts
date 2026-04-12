declare module 'yauzl' {
  import type { ReadStream } from 'node:fs';
  import type { EventEmitter } from 'node:events';

  export interface Entry {
    fileName: string;
  }

  export interface ZipFile extends EventEmitter {
    entryCount: number;
    readEntry(): void;
    openReadStream(
      entry: Entry,
      callback: (error: Error | null, stream?: ReadStream) => void,
    ): void;
    close(): void;
  }

  export function open(
    path: string,
    options: { lazyEntries: boolean },
    callback: (error: Error | null, zipFile?: ZipFile) => void,
  ): void;

  export function fromBuffer(
    buffer: Buffer,
    options: { lazyEntries: boolean },
    callback: (error: Error | null, zipFile?: ZipFile) => void,
  ): void;
}
