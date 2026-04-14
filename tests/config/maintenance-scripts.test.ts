import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

describe('maintenance script surface', () => {
  test('does not expose source snapshot or source index backfill commands', async () => {
    const packageJson = JSON.parse(await readRepoFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    const readme = await readRepoFile('README.md');
    const readmeZhCn = await readRepoFile('README.zh-CN.md');
    const agentsGuide = await readRepoFile('AGENTS.md');

    expect(packageJson.scripts).not.toHaveProperty('backfill:source-snapshots');
    expect(packageJson.scripts).not.toHaveProperty('backfill:source-indexes');

    for (const content of [readme, readmeZhCn, agentsGuide]) {
      expect(content).not.toContain('backfill:source-snapshots');
      expect(content).not.toContain('backfill:source-indexes');
    }
  });
});
