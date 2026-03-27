import { readFile } from 'node:fs/promises';

import { fail } from '@/lib/api';
import { getVersionSourceArchive } from '@/lib/server/upload-service';

type Context = {
  params: Promise<{ id: string }>;
};

function buildContentDisposition(fileName: string) {
  const safeFileName = fileName.replace(/["\\]/g, '_');
  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const sourceArchive = await getVersionSourceArchive(Number(id));

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
