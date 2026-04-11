import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { redirectMock, getManifestMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string | { href: string; locale?: string }) => {
    const href = typeof target === 'string' ? target : target.href;
    throw new Error(`REDIRECT:${href}`);
  }),
  getManifestMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  redirect: redirectMock,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/server/manifest-service', () => ({
  getManifest: getManifestMock,
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('zh'),
  getTranslations: vi.fn().mockResolvedValue((key: string, values?: Record<string, string>) => {
    if (key === 'title') return '产品不存在';
    if (key === 'back') return '返回预览列表';
    if (key === 'description') return `无法找到标识为 ${values?.productKey} 的产品`;
    return key;
  }),
}));

import PreviewProductRoutePage from '@/app/preview/[productKey]/page';
import PreviewVersionRoutePage from '@/app/preview/[productKey]/[version]/page';

describe('preview route redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders standalone viewer route when product and version are canonical', async () => {
    getManifestMock.mockResolvedValue({
      products: [
        {
          key: 'crm',
          name: 'CRM',
          description: null,
          defaultVersion: 'v1.2.0',
          createdAt: '2026-04-10T00:00:00.000Z',
          versions: [
            {
              version: 'v1.2.0',
              title: null,
              remark: null,
              entryUrl: '/prototypes/crm/v1.2.0/index.html',
              createdAt: '2026-04-10T00:00:00.000Z',
              isDefault: true,
              isLatest: true,
            },
          ],
        },
      ],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewProductRoutePage({
        params: Promise.resolve({ productKey: 'crm' }),
        searchParams: Promise.resolve({ v: 'v1.2.0' }),
      }),
    ).resolves.toBeTruthy();

    expect(redirectMock).not.toHaveBeenCalled();
  });

  test('renders standalone viewer route without redirect when version query is omitted', async () => {
    getManifestMock.mockResolvedValue({
      products: [
        {
          key: 'crm',
          name: 'CRM',
          description: null,
          defaultVersion: 'v1.2.0',
          createdAt: '2026-04-10T00:00:00.000Z',
          versions: [
            {
              version: 'v1.2.0',
              title: null,
              remark: null,
              entryUrl: '/prototypes/crm/v1.2.0/index.html',
              createdAt: '2026-04-10T00:00:00.000Z',
              isDefault: true,
              isLatest: true,
            },
          ],
        },
      ],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewProductRoutePage({
        params: Promise.resolve({ productKey: 'crm' }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();

    expect(redirectMock).not.toHaveBeenCalled();
  });

  test('redirects invalid standalone viewer versions to the canonical resolved route', async () => {
    getManifestMock.mockResolvedValue({
      products: [],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewVersionRoutePage({
        params: Promise.resolve({ productKey: 'crm', version: 'broken-version' }),
      }),
    ).rejects.toThrow('REDIRECT:/preview/crm?v=v1.2.0');

    expect(getManifestMock).toHaveBeenCalledWith('crm', 'broken-version');
  });

  test('redirects product viewer route with invalid version query to canonical version query', async () => {
    getManifestMock.mockResolvedValue({
      products: [],
      resolved: { productKey: 'crm', version: 'v1.2.0' },
    });

    await expect(
      PreviewProductRoutePage({
        params: Promise.resolve({ productKey: 'crm' }),
        searchParams: Promise.resolve({ v: 'broken-version' }),
      }),
    ).rejects.toThrow('REDIRECT:/preview/crm?v=v1.2.0');

    expect(getManifestMock).toHaveBeenCalledWith('crm', 'broken-version');
  });

  test('renders a product-not-found state for unknown product viewer routes', async () => {
    getManifestMock.mockResolvedValue({
      products: [],
      resolved: { productKey: 'erp', version: 'v2.0.0' },
    });

    const page = await PreviewProductRoutePage({
      params: Promise.resolve({ productKey: 'crm' }),
      searchParams: Promise.resolve({ v: 'v1.0.0' }),
    });

    expect(renderToStaticMarkup(page)).toContain('产品不存在');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
