# Prototype Manage Tool

一个开源、自托管的前端原型发布与预览平台，提供统一的产品/版本预览入口，以及用于管理上传、构建任务、发布状态和默认版本的后台工作台。

[English](./README.md) | [MIT License](./LICENSE)

## 项目简介

Prototype Manage Tool 适用于需要按产品和版本管理静态前端原型的团队。它将 Next.js 应用壳、基于 Prisma 的元数据存储，以及基于文件系统的原型发布能力组合在同一个仓库中。

这个仓库主要面向：

- 希望自部署内部原型展示平台的使用者
- 希望扩展上传、构建、预览流程的贡献者

## 核心能力

- 在 `/preview` 提供统一预览页，支持按产品和已发布版本切换
- 在 `/admin` 提供管理后台，支持创建产品、上传原型压缩包、查看构建任务、设置默认版本、下线版本和删除记录
- 提供产品、版本、manifest 解析、构建任务状态和预览路由等 API
- 通过 `/prototypes/*` 提供基于文件系统的静态原型访问
- 提供 `POST /api/mcp` 接口，用于查询已发布版本的源码快照
- 提供可直接体验的演示种子数据
- 提供面向 Docker 部署的镜像发布工作流

## 技术栈

- Next.js App Router
- TypeScript
- Ant Design
- Prisma
- SQLite
- 基于本地文件系统的产物存储

## 快速开始

### 前置要求

- Node.js 22 或更高版本
- pnpm 10 或更高版本
- 如果要使用容器部署，需要 Docker

### 本地开发

1. 安装依赖：

```bash
pnpm install
```

2. 从示例环境变量文件复制：

```bash
cp .env.example .env
```

3. 初始化 Prisma 并写入演示数据：

```bash
pnpm prisma:generate
pnpm db:push
pnpm db:seed
```

4. 启动开发服务器：

```bash
pnpm dev
```

5. 打开页面：

- 预览页：`http://localhost:3000/preview`
- 管理台：`http://localhost:3000/admin`

## 环境变量

### 本地环境

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma 使用的 SQLite 连接串 |
| `DATA_DIR` | `./data` | SQLite、上传文件、构建任务和发布产物的根目录 |
| `UPLOAD_MAX_MB` | `200` | 上传文件大小上限，单位 MB |
| `APP_URL` | `http://localhost:3000` | 对外访问地址 |
| `MCP_AUTH_TOKEN` | _(空)_ | `POST /api/mcp` 的 Bearer Token；为空时 MCP 接口禁用 |

### Docker 环境

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_TAG` | `latest` | `compose.yml` 使用的镜像标签 |
| `APP_URL` | `http://localhost` | 对外访问地址 |
| `APP_PORT` | `3000` | 宿主机映射端口 |
| `UPLOAD_MAX_MB` | `200` | 上传文件大小上限，单位 MB |
| `MCP_AUTH_TOKEN` | _(空)_ | `POST /api/mcp` 的 Bearer Token；为空时 MCP 接口禁用 |

## 演示数据

执行 `pnpm db:seed` 后，会自动创建演示产品和已发布版本，便于在本地环境中直接体验。当前种子数据包含 CRM 和 ERP 示例原型。

## 原型上传机制

平台会接收源码压缩包、安装依赖、执行构建、校验构建产物，然后将结果发布到数据目录中。

当前约束如下：

- 仅接受 `.zip` 上传
- 压缩包中必须包含 `package.json`
- 当前只支持 `pnpm` 和 `npm` 项目
- 项目必须定义 `build` 脚本
- 构建产物必须从 `dist/` 发布
- `dist/index.html` 必须使用相对资源路径
- `/assets/...` 这类根绝对路径资源引用会被拒绝

## MCP 源码快照

仓库内置了基于 `@modelcontextprotocol/sdk` 的 MCP 接口。

- 接口地址：`POST /api/mcp`
- 路由模式：无状态请求处理（调用之间不持久化会话）
- 鉴权方式：`Authorization: Bearer <MCP_AUTH_TOKEN>`
- 可用条件：`MCP_AUTH_TOKEN` 为空时 MCP 接口返回禁用状态
- 可见性范围：仅暴露 `status=published` 且源码快照 `status=ready` 的版本

MCP 相关操作不支持非 POST 方法：

- `GET /api/mcp` 返回 `405`
- `DELETE /api/mcp` 返回 `405`

### 可用 MCP 工具

- `list_products`：列出当前存在已发布源码快照的产品
- `list_versions`：列出某产品已发布的源码快照版本
- `resolve_version`：按 `default`、`latest` 或精确版本号解析版本
- `get_source_tree`：读取已发布源码快照的目录/文件树
- `read_source_file`：读取已发布源码快照中的文本文件内容
- `search_source_files`：在已发布源码快照中执行文本搜索

### 回填源码快照

如果历史已发布版本早于源码快照功能上线，可执行：

```bash
pnpm backfill:source-snapshots
```

该命令会扫描已发布版本，恢复其源码归档，并为缺失项生成源码快照。

## 可用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 构建 Next.js 应用 |
| `pnpm start` | 启动生产服务器 |
| `pnpm test` | 运行 Vitest 测试 |
| `pnpm test:watch` | 以 watch 模式运行 Vitest |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm prisma:generate` | 生成 Prisma Client |
| `pnpm prisma:migrate` | 在开发环境创建并应用 Prisma migration |
| `pnpm db:push` | 将 Prisma schema 推送到 SQLite 数据库 |
| `pnpm db:seed` | 写入演示产品和版本 |
| `pnpm init` | 生成 Prisma Client、推送 schema 并写入演示数据 |
| `pnpm backfill:source-snapshots` | 为已发布版本回填缺失的源码快照 |

## Docker 部署

仓库已经提供了运行镜像和 `compose.yml`，可用于自托管部署。

### 需要准备的文件

- `compose.yml`
- `.env.docker`
- `docker-data/`

先从 `.env.docker.example` 复制出 `.env.docker`，再按实际情况调整：

- `APP_URL`
- `APP_PORT`
- `IMAGE_TAG`
- `MCP_AUTH_TOKEN`

默认情况下，持久化数据会挂载到宿主机的 `./docker-data`，容器内路径为 `/app/data`。其中包括：

- SQLite 数据库：`/app/data/sqlite/app.db`
- 已发布原型：`/app/data/prototypes`
- 上传临时目录：`/app/data/uploads-temp`
- 构建任务工作目录：`/app/data/build-jobs`

### 初始化数据库

```bash
docker compose --env-file .env.docker --profile init run --rm db-init
```

如果还需要演示数据：

```bash
docker compose --env-file .env.docker --profile seed run --rm seed-demo
```

### 启动应用

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

默认访问入口为：

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`

### 文件句柄限制

仓库提供的 `compose.yml` 已设置 `ulimits.nofile=65535`。如果你用其他方式运行容器，请显式设置相同限制。否则上传的 Vite 或 Tailwind 项目在依赖解析阶段可能出现具有误导性的构建错误。

### 升级与回滚

修改 `.env.docker` 中的 `IMAGE_TAG` 后，执行：

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

镜像升级不会覆盖 `docker-data/` 中的持久化数据。

## Docker 镜像发布

仓库包含 `.github/workflows/docker-publish.yml`，用于将运行镜像发布到 Docker Hub：

- 镜像仓库：`horizon2333/prototype-manage-tool`
- `main` 分支发布 `latest`
- `v*` 标签发布对应版本标签

要启用该工作流，需要配置以下仓库 Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## 仓库结构

```text
app/                    Next.js 页面、路由与 API 处理器
components/             管理台和预览页 UI 组件
lib/                    配置、领域逻辑与服务端工具
prisma/                 Prisma schema
scripts/                种子与辅助脚本
tests/                  核心行为单元测试
data/                   本地 SQLite、上传文件和发布产物
docker/                 容器入口脚本与 Docker 相关文件
public/                 静态资源
```

## 测试

在发起 Pull Request 前，建议至少执行以下验证命令：

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 贡献说明

欢迎贡献。对于会影响上传、构建、预览或发布流程的修改，建议遵循以下原则：

- 将行为变化控制在清晰可说明的范围内
- 逻辑有变更时同步补充或更新 `tests/` 下的测试
- 在 Pull Request 中明确说明运行和部署层面的影响
- 如果修改了部署相关文件，补充验证本地或 Docker 行为

如果你不确定从哪里开始阅读，优先查看 `app/api/` 下的接口路由以及 `lib/server/` 下的服务端逻辑，通常是理解系统的最快入口。

## 项目状态

项目已经可用，但仍处于较早阶段。数据模型、管理台流程和部署细节仍可能继续演进。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE)。
