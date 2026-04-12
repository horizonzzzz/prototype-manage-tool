export const runtime = 'nodejs';

import fs from 'node:fs/promises';
import path from 'node:path';

import mime from 'mime-types';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { appConfig } from '@/lib/config';
import { ensureChildPath } from '@/lib/domain/path-safety';
import { prisma } from '@/lib/prisma';

type Context = {
  params: Promise<{ slug: string[] }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const user = (await auth())?.user;
    if (!user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { slug } = await context.params;

    if (!slug?.length || slug.length < 2) {
      return new NextResponse('Not found', { status: 404 });
    }

    const [productKey, version, ...assetSegments] = slug;
    const targetVersion = await prisma.productVersion.findFirst({
      where: {
        version,
        status: 'published',
        product: {
          key: productKey,
          ownerId: user.id,
        },
      },
      select: {
        storagePath: true,
      },
    });

    if (!targetVersion?.storagePath) {
      return new NextResponse('Not found', { status: 404 });
    }

    const filePath = ensureChildPath(targetVersion.storagePath, ...(assetSegments.length ? assetSegments : ['index.html']));
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const content = await fs.readFile(filePath);
    const contentType = mime.lookup(path.basename(filePath)) || 'application/octet-stream';

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}

