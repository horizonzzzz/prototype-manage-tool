import { describe, expect, test } from 'vitest';

import { getErrorMessage } from '@/lib/domain/error-message';

describe('getErrorMessage', () => {
  test('returns message from Error instances', () => {
    expect(getErrorMessage(new Error('upload failed'))).toBe('upload failed');
  });

  test('falls back for unknown values', () => {
    expect(getErrorMessage(null, '默认错误')).toBe('默认错误');
  });
});

