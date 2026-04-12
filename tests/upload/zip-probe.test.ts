import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { probeZipArchive } from '@/lib/server/fs-utils';

const tempDirs: string[] = [];
const VALID_ZIP_BASE64 =
  'UEsDBBQAAAAIAFFxjFyFEUoNDQAAAAsAAAAJAAAAaGVsbG8udHh0y0jNyclXKM8vykkBAFBLAQIUABQAAAAIAFFxjFyFEUoNDQAAAAsAAAAJAAAAAAAAAAAAAAAAAAAAAABoZWxsby50eHRQSwUGAAAAAAEAAQA3AAAANAAAAAAA';

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-probe-test-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function getValidZipBuffer() {
  return Buffer.from(VALID_ZIP_BASE64, 'base64');
}

describe('probeZipArchive', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })));
  });

  test('returns the entry count for a valid zip archive', async () => {
    const tempDir = await createTempDir();
    const zipPath = path.join(tempDir, 'fixture.zip');
    await fs.writeFile(zipPath, getValidZipBuffer());

    await expect(probeZipArchive(zipPath)).resolves.toEqual({
      entryCount: 1,
    });
  });

  test('rejects invalid zip archives before extraction starts', async () => {
    const tempDir = await createTempDir();
    const zipPath = path.join(tempDir, 'invalid.zip');
    await fs.writeFile(zipPath, Buffer.from('not-a-zip'));

    await expect(probeZipArchive(zipPath)).rejects.toThrow(/not a zip|truncated/i);
  });
});
