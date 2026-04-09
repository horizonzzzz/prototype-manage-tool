const SAFE_ROUTE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function isSafeRouteSegment(value: string) {
  return SAFE_ROUTE_SEGMENT.test(value) && !value.includes('..');
}

export function assertSafeRouteSegment(value: string, label: string) {
  if (!isSafeRouteSegment(value)) {
    throw new Error(`Invalid ${label}`);
  }

  return value;
}
