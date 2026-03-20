# Prototype Manage Tool

一个基于 `Next.js + Ant Design + Prisma + SQLite` 的前端原型发布与展示平台。

## 功能

- `/preview`：统一预览页，按产品 / 版本切换原型
- `/admin`：后台管理，支持新建产品、上传源码 zip、后台安装依赖与构建、设默认、下线、删除
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
- zip 中必须包含 `package.json`
- 当前仅支持 `pnpm` / `npm` 项目
- `package.json` 中必须存在 `build` 脚本
- 构建产物固定要求输出到 `dist/`
- 平台默认要求 `dist/index.html` 使用相对资源路径
- 若 `dist/index.html` 中存在 `/assets/...` 这类根绝对路径资源引用，任务会被判定失败

## 初始化数据

`pnpm db:seed` 会自动创建 `crm`、`erp` 两个产品及 demo 页面。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Docker 部署

### 1. 准备部署目录

服务器只需要以下内容：

- `compose.yml`
- `.env.docker`
- `docker-data/`

复制 `.env.docker.example` 为 `.env.docker`，并按实际域名修改：

- `APP_URL`
- `APP_PORT`
- `IMAGE_TAG`（默认 `latest`，正式环境建议使用明确版本号）

宿主机持久化目录默认使用项目下的 `./docker-data`，容器内映射为 `/app/data`，包含：

- SQLite：`/app/data/sqlite/app.db`
- 原型文件：`/app/data/prototypes`
- 上传临时目录：`/app/data/uploads-temp`
- 构建任务目录：`/app/data/build-jobs`

### 2. 初始化数据库

首次部署先执行：

```bash
docker compose --env-file .env.docker --profile init run --rm db-init
```

如果你希望导入演示数据，再额外执行：

```bash
docker compose --env-file .env.docker --profile seed run --rm seed-demo
```

### 3. 启动服务

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

默认通过应用容器直接暴露 `${APP_PORT:-3000}` 端口：

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`

### 4. 升级

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

升级时只需要修改 `.env.docker` 中的 `IMAGE_TAG`，然后重新执行上面的两条命令。
升级不会覆盖 `docker-data/` 中的数据库和原型文件。

### 5. 回滚

将 `.env.docker` 中的 `IMAGE_TAG` 改回旧版本，例如 `v0.1.0`，然后执行：

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

### 6. 备份与恢复

备份 `docker-data/` 目录即可；恢复时停掉容器、回滚该目录，然后重新启动。

## Docker Hub 发布

镜像仓库：`horizon2333/prototype-manage-tool`

- `latest`：`main` 分支最新可部署镜像
- `vX.Y.Z`：正式版本镜像
- `sha-<commit>`：提交级别镜像，便于排查

### GitHub Actions 自动发布

为仓库配置以下 Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

当 `main` 分支有新提交，或推送 `v*` 标签时，GitHub Actions 会自动构建并推送镜像。

### 本地手动兜底发布

```bash
docker buildx build --target runner --platform linux/amd64 -t horizon2333/prototype-manage-tool:latest -t horizon2333/prototype-manage-tool:v0.1.0 --push .
```
