# Prototype Preview MVP

一个基于 `Next.js + Ant Design + Prisma + SQLite` 的前端原型发布与展示平台。

## 功能

- `/preview`：统一预览页，按产品 / 版本切换原型
- `/admin`：后台管理，支持新建产品、上传 `dist.zip`、设默认、下线、删除
- `/api/*`：产品、版本、manifest、preview-resolve 等接口
- `/prototypes/*`：统一静态原型访问路径

## 技术栈

- Next.js App Router
- TypeScript
- Ant Design
- Prisma + SQLite
- 本地文件系统发布

## 目录

```text
app/                    页面、路由与 API
components/             管理台与预览台组件
lib/                    配置、领域逻辑、服务端工具
prisma/                 Prisma schema
scripts/                初始化与种子脚本
data/                   SQLite、临时上传、原型发布目录
tests/                  核心单元测试
```

## 环境变量

复制 `.env.example` 为 `.env`，然后执行：

```bash
pnpm prisma:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

## 上传规范

- 仅支持 `zip`
- zip 中必须包含 `index.html`
- 平台默认要求构建产物使用相对资源路径
- 若 `index.html` 中存在 `/assets/...` 这类根绝对路径资源引用，上传会被拒绝

## 初始化数据

`pnpm db:seed` 会自动创建 `crm`、`erp` 两个产品及 demo 页面。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```
