export const runtime = 'nodejs';

import fs from 'node:fs/promises';

import { NextResponse } from 'next/server';

import { resolveAvatarContentType, resolveAvatarFilePath } from '@/lib/server/user-settings-service';

type Context = {
  params: Promise<{ slug: string[] }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { slug } = await context.params;
    if (!slug || slug.length !== 2) {
      return new NextResponse('Not found', { status: 404 });
    }

    const [userId, fileName] = slug;
    const filePath = resolveAvatarFilePath(userId, fileName);
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const content = await fs.readFile(filePath);

    return new NextResponse(content, {
      headers: {
        'Content-Type': resolveAvatarContentType(fileName),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
