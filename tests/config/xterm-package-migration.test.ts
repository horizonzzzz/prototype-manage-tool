import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const projectRoot = path.resolve(__dirname, '../..');

async function readProjectFile(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

describe('xterm package migration', () => {
  test('uses scoped xterm packages instead of deprecated package names', async () => {
    const [packageJson, terminalComponent, globalsCss] = await Promise.all([
      readProjectFile('package.json'),
      readProjectFile('components/build-job-terminal.tsx'),
      readProjectFile('app/globals.css'),
    ]);

    expect(packageJson).toContain('"@xterm/xterm"');
    expect(packageJson).toContain('"@xterm/addon-fit"');
    expect(packageJson).not.toContain('"xterm"');
    expect(packageJson).not.toContain('"xterm-addon-fit"');

    expect(terminalComponent).toContain("import('@xterm/xterm')");
    expect(terminalComponent).toContain("import('@xterm/addon-fit')");
    expect(terminalComponent).not.toContain("import('xterm')");
    expect(terminalComponent).not.toContain("import('xterm-addon-fit')");

    expect(globalsCss).toContain("@import '@xterm/xterm/css/xterm.css';");
    expect(globalsCss).not.toContain("@import 'xterm/css/xterm.css';");
  });
});
