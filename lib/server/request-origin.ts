function readFirstHeaderValue(requestHeaders: Headers, name: string): string | null {
  const rawValue = requestHeaders.get(name);

  if (!rawValue) {
    return null;
  }

  const [firstValue] = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return firstValue || null;
}

export function resolveRequestOrigin(requestHeaders: Headers, fallbackUrl: string): string {
  const forwardedProtocol = readFirstHeaderValue(requestHeaders, 'x-forwarded-proto');
  const forwardedHost = readFirstHeaderValue(requestHeaders, 'x-forwarded-host');
  const host = readFirstHeaderValue(requestHeaders, 'host');
  const fallbackOrigin = new URL(fallbackUrl).origin;

  if (forwardedProtocol && forwardedHost) {
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  if (forwardedHost) {
    return `${new URL(fallbackOrigin).protocol}//${forwardedHost}`;
  }

  if (host) {
    return `${new URL(fallbackOrigin).protocol}//${host}`;
  }

  return fallbackOrigin;
}

export function buildMcpEndpointUrl(origin: string): string {
  return new URL('/api/mcp', origin).toString();
}
