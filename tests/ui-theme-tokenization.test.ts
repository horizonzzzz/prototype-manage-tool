import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const primitiveFiles = [
  '../components/ui/card.tsx',
  '../components/ui/input.tsx',
  '../components/ui/button.tsx',
  '../components/ui/select.tsx',
  '../components/ui/dropdown-menu.tsx',
] as const;

const primitiveSources = Object.fromEntries(
  primitiveFiles.map((filePath) => [filePath, readFileSync(new URL(filePath, import.meta.url), 'utf8')]),
);

describe('ui primitive theme tokenization', () => {
  test('avoids hard-coded light white/slate utility colors in shared primitives', () => {
    for (const source of Object.values(primitiveSources)) {
      expect(source).not.toMatch(/\bbg-white(?:\/\d+)?\b/);
      expect(source).not.toMatch(/\btext-slate-\d+\b/);
      expect(source).not.toMatch(/\bhover:bg-white\b/);
      expect(source).not.toMatch(/\bhover:bg-slate-\d+\b/);
      expect(source).not.toMatch(/\bfocus:bg-slate-\d+\b/);
    }
  });

  test('uses theme tokens for shared control surface and text colors', () => {
    expect(primitiveSources['../components/ui/card.tsx']).toContain('bg-card');
    expect(primitiveSources['../components/ui/input.tsx']).toContain('border-input');
    expect(primitiveSources['../components/ui/button.tsx']).toContain('text-foreground');
    expect(primitiveSources['../components/ui/select.tsx']).toContain('bg-popover');
    expect(primitiveSources['../components/ui/dropdown-menu.tsx']).toContain('bg-popover');
  });
});
