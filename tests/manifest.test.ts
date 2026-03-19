import { describe, expect, test } from 'vitest';

import { pickVersionForPreview } from '@/lib/domain/preview';

describe('pickVersionForPreview', () => {
  test('prefers explicit version match', () => {
    const result = pickVersionForPreview(
      [
        { version: 'v1.0.0', isDefault: false, createdAt: new Date('2024-01-01') },
        { version: 'v1.1.0', isDefault: true, createdAt: new Date('2024-02-01') },
      ],
      'v1.0.0',
    );

    expect(result?.version).toBe('v1.0.0');
  });

  test('falls back to default version', () => {
    const result = pickVersionForPreview(
      [
        { version: 'v1.0.0', isDefault: false, createdAt: new Date('2024-01-01') },
        { version: 'v1.1.0', isDefault: true, createdAt: new Date('2024-02-01') },
      ],
      undefined,
    );

    expect(result?.version).toBe('v1.1.0');
  });

  test('falls back to latest created version when no default', () => {
    const result = pickVersionForPreview(
      [
        { version: 'v1.0.0', isDefault: false, createdAt: new Date('2024-01-01') },
        { version: 'v1.1.0', isDefault: false, createdAt: new Date('2024-02-01') },
      ],
      undefined,
    );

    expect(result?.version).toBe('v1.1.0');
  });
});

