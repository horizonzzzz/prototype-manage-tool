import fs from 'node:fs/promises';
import path from 'node:path';

import fse from 'fs-extra';

import { appConfig } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/server/password';
import { ensureAppDirectories } from '@/lib/server/fs-utils';

const products = [
  { key: 'crm', name: 'CRM 系统', description: '销售与客户管理原型' },
  { key: 'erp', name: 'ERP 平台', description: '供应链与库存管理原型' },
];

const demoVersions = [
  { productKey: 'crm', version: 'v1.0.0', title: 'CRM 首版原型', remark: '包含商机看板、客户列表、转化漏斗', accent: '#1677ff' },
  { productKey: 'crm', version: 'v1.1.0', title: 'CRM 升级版', remark: '新增销售日历与团队目标模块', accent: '#7c3aed' },
  { productKey: 'erp', version: 'v2.0.0', title: 'ERP 仓储首页', remark: '包含出入库趋势与库存预警', accent: '#059669' },
];

function buildHtml(item: (typeof demoVersions)[number]) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${item.title}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #0f172a; }
      .hero { padding: 32px; background: linear-gradient(135deg, ${item.accent}, #0ea5e9); color: white; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 24px; }
      .card { background: white; border-radius: 18px; padding: 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08); }
      .metric { font-size: 32px; font-weight: 700; margin-top: 12px; }
      .tag { display: inline-block; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.2); }
      .footer { padding: 0 24px 24px; color: #64748b; }
    </style>
  </head>
  <body>
    <section class="hero">
      <span class="tag">${item.productKey} / ${item.version}</span>
      <h1>${item.title}</h1>
      <p>${item.remark}</p>
    </section>
    <section class="grid">
      <div class="card"><div>本周活跃用户</div><div class="metric">12,480</div></div>
      <div class="card"><div>转化率</div><div class="metric">28.4%</div></div>
      <div class="card"><div>待处理事项</div><div class="metric">19</div></div>
    </section>
    <div class="footer">这是平台初始化生成的演示原型页面，可直接用于预览与切换。</div>
  </body>
</html>`;
}

async function main() {
  await ensureAppDirectories();

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {
      name: 'demo',
      passwordHash: hashPassword('Demo123456'),
    },
    create: {
      email: 'demo@example.com',
      name: 'demo',
      passwordHash: hashPassword('Demo123456'),
    },
  });

  await Promise.all(
    products.map((product) =>
      prisma.product.upsert({
        where: { ownerId_key: { ownerId: demoUser.id, key: product.key } },
        update: { name: product.name, description: product.description },
        create: {
          ...product,
          ownerId: demoUser.id,
        },
      }),
    ),
  );

  for (const item of demoVersions) {
    const product = await prisma.product.findUniqueOrThrow({
      where: { ownerId_key: { ownerId: demoUser.id, key: item.productKey } },
    });
    const publishDir = path.join(appConfig.prototypesDir, demoUser.id, item.productKey, item.version);
    await fse.ensureDir(publishDir);
    await fs.writeFile(path.join(publishDir, 'index.html'), buildHtml(item), 'utf8');

    await prisma.productVersion.upsert({
      where: { productId_version: { productId: product.id, version: item.version } },
      update: {
        title: item.title,
        remark: item.remark,
        storagePath: publishDir,
        entryUrl: `/prototypes/${item.productKey}/${item.version}/index.html`,
        status: 'published',
        isDefault: item.productKey === 'crm' ? item.version === 'v1.1.0' : true,
      },
      create: {
        productId: product.id,
        version: item.version,
        title: item.title,
        remark: item.remark,
        storagePath: publishDir,
        entryUrl: `/prototypes/${item.productKey}/${item.version}/index.html`,
        status: 'published',
        isDefault: item.productKey === 'crm' ? item.version === 'v1.1.0' : true,
      },
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

