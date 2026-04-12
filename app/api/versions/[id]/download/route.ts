import { readFile } from 'node:fs/promises';

import { fail } from '@/lib/api';
import { getApiUser } from '@/lib/server/api-auth';
import { getVersionSourceArchive } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

function buildContentDisposition(fileName: string) {
  const asciiFallback = fileName
    .replace(/[\r\n]/g, '_')
    .replace(/["\\]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  const safeFileName = asciiFallback || 'download.zip';
  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_: Request, context: Context) {
  try {
    const user = await getApiUser();
    if (!user?.id) {
      return fail('Unauthorized', 401);
    }

    const { id } = await context.params;
    const sourceArchive = await getVersionSourceArchive(user.id, Number(id));

    if (!sourceArchive) {
      return fail('Original zip unavailable', 404);
    }

    const fileBuffer = await readFile(sourceArchive.filePath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': buildContentDisposition(sourceArchive.fileName),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '下载原始 zip 失败';
    const status = message === 'Version not found' || message === 'Original zip unavailable' ? 404 : 400;
    return fail(message, status);
  }
}
