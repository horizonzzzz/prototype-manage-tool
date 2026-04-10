import { beforeEach, describe, expect, test, vi } from 'vitest';

const { redirectMock, getManifestMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  getManifestMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/server/manifest-service', () => ({
  getManifest: getManifestMock,
}));

import PreviewProductRoutePage from '@/app/preview/[productKey]/page';
import PreviewVersionRoutePage from '@/app/preview/[productKey]/[version]/page';

describe('preview route redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('redirects preview product routes into preview list query state', async () => {
    getManifestMock.mockResolvedValue({
      products: [],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewProductRoutePage({
        params: Promise.resolve({ productKey: 'crm' }),
      }),
    ).rejects.toThrow('REDIRECT:/preview?product=crm&version=v1.2.0');
  });

  test('redirects invalid preview version routes to the canonical resolved route', async () => {
    getManifestMock.mockResolvedValue({
      products: [],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewVersionRoutePage({
        params: Promise.resolve({ productKey: 'crm', version: 'broken-version' }),
      }),
    ).rejects.toThrow('REDIRECT:/preview?product=crm&version=v1.2.0');

    expect(getManifestMock).toHaveBeenCalledWith('crm', 'broken-version');
  });
});
