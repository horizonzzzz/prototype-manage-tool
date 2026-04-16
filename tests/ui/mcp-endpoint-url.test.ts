import { describe, expect, test } from 'vitest';

type McpEndpointModule = {
  buildMcpEndpointUrl: (origin: string) => string;
  resolveRequestOrigin: (requestHeaders: Headers, fallbackUrl: string) => string;
};

async function loadMcpEndpointModule(): Promise<Partial<McpEndpointModule>> {
  try {
    return (await import('@/lib/server/request-origin')) as McpEndpointModule;
  } catch {
    return {};
  }
}

describe('mcp endpoint url helpers', () => {
  test('prefers forwarded proto and host headers when building request origin', async () => {
    const module = await loadMcpEndpointModule();

    expect(typeof module.resolveRequestOrigin).toBe('function');

    if (typeof module.resolveRequestOrigin !== 'function') {
      return;
    }

    const requestHeaders = new Headers({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'deploy.example.com:8443',
      host: 'internal.local:3000',
    });

    expect(module.resolveRequestOrigin(requestHeaders, 'http://localhost:3000')).toBe('https://deploy.example.com:8443');
  });

  test('falls back to host header when forwarded headers are unavailable', async () => {
    const module = await loadMcpEndpointModule();

    expect(typeof module.resolveRequestOrigin).toBe('function');

    if (typeof module.resolveRequestOrigin !== 'function') {
      return;
    }

    const requestHeaders = new Headers({
      host: '192.168.1.20:3000',
    });

    expect(module.resolveRequestOrigin(requestHeaders, 'http://localhost:3000')).toBe('http://192.168.1.20:3000');
  });

  test('falls back to configured app url when request headers do not include an origin', async () => {
    const module = await loadMcpEndpointModule();

    expect(typeof module.resolveRequestOrigin).toBe('function');

    if (typeof module.resolveRequestOrigin !== 'function') {
      return;
    }

    expect(module.resolveRequestOrigin(new Headers(), 'https://app.example.com')).toBe('https://app.example.com');
  });

  test('builds the mcp endpoint path from the resolved origin', async () => {
    const module = await loadMcpEndpointModule();

    expect(typeof module.buildMcpEndpointUrl).toBe('function');

    if (typeof module.buildMcpEndpointUrl !== 'function') {
      return;
    }

    expect(module.buildMcpEndpointUrl('https://app.example.com:9443')).toBe('https://app.example.com:9443/api/mcp');
  });
});
