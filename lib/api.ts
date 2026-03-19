import { NextResponse } from 'next/server';

import type { ApiResponse } from '@/lib/types';

export function ok<T>(data: T, message = 'ok') {
  return NextResponse.json<ApiResponse<T>>({
    success: true,
    message,
    data,
  });
}

export function fail(message: string, status = 400, data?: unknown) {
  return NextResponse.json<ApiResponse<unknown>>(
    {
      success: false,
      message,
      data,
    },
    { status },
  );
}

