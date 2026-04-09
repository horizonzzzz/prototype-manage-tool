import { describe, expect, test } from 'vitest';

import { buildPreviewHref } from '@/lib/ui/navigation';

describe('preview route href safety', () => {
  test('builds segment-based preview hrefs for safe route values', () => {
    expect(buildPreviewHref('crm', 'v1.2.0-beta_1')).toBe('/preview/crm/v1.2.0-beta_1');
  });
});
