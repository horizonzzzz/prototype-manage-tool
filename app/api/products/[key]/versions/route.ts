import { ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { serializeUploadRecord, serializeVersion } from '@/lib/server/serializers';

type Context = {
  params: Promise<{ key: string }>;
};

export async function GET(request: Request, context: Context) {
  const { key } = await context.params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get('includeRecords') === 'true') {
    const records = await prisma.uploadRecord.findMany({
      where: { productKey: key },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return ok(records.map(serializeUploadRecord));
  }

  const product = await prisma.product.findUnique({
    where: { key },
    include: { versions: true },
  });

  const latestVersion = [...(product?.versions ?? [])].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0]?.version;

  return ok((product?.versions ?? []).map((version) => serializeVersion(version, latestVersion)));
}

