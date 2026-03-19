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

## Docker 部署

### 1. 准备环境变量与持久化目录

复制 `.env.docker.example` 为 `.env.docker`，并按实际域名修改 `APP_URL`。

宿主机持久化目录默认使用项目下的 `./docker-data`，容器内映射为 `/app/data`，包含：

- SQLite：`/app/data/sqlite/app.db`
- 原型文件：`/app/data/prototypes`
- 上传临时目录：`/app/data/uploads-temp`

### 2. 初始化数据库

首次部署先执行：

```bash
docker compose --profile init run --rm db-init
```

如果你希望导入演示数据，再额外执行：

```bash
docker compose --profile seed run --rm seed-demo
```

### 3. 启动服务

```bash
docker compose up -d --build
```

默认通过应用容器直接暴露 `${APP_PORT:-3000}` 端口：

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`

### 4. 升级

```bash
docker compose up -d --build
```

升级不会覆盖 `docker-data/` 中的数据库和原型文件。

### 5. 备份与恢复

备份 `docker-data/` 目录即可；恢复时停掉容器、回滚该目录，然后重新启动。
