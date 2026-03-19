export const runtime = 'nodejs';

import { fail, ok } from '@/lib/api';
import { processPrototypeUpload } from '@/lib/server/upload-service';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const productKey = String(formData.get('productKey') ?? '');
    const version = String(formData.get('version') ?? '');
    const title = String(formData.get('title') ?? '');
    const remark = String(formData.get('remark') ?? '');
    const file = formData.get('file');

    if (!productKey || !version || !(file instanceof File)) {
      return fail('Missing upload fields', 400);
    }

    const result = await processPrototypeUpload({
      productKey,
      version,
      title,
      remark,
      fileName: file.name,
      fileSize: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    return ok(result, '上传任务已创建');
  } catch (error) {
    return fail(error instanceof Error ? error.message : '上传失败', 400);
  }
}
