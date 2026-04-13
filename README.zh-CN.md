# Prototype Manage Tool

Prototype Manage Tool 是一个按产品和版本发布静态前端原型的自托管平台。
它主要提供三个工作入口：

- `/preview`：浏览已发布原型，并在产品与版本之间切换
- `/admin`：上传源码压缩包、查看构建任务、发布或下线版本、管理默认版本
- `POST /api/mcp`：通过 MCP 让 agent 直接读取已发布版本的源码快照

[English](./README.md) | [MIT License](./LICENSE)

## 项目定位

应用会长期维护三类状态：

- 通过 Prisma 管理的 SQLite 元数据
- 位于 `data/prototypes/<userId>/<productKey>/<version>/` 的已发布静态产物
- 位于 `data/source-snapshots/<userId>/<productKey>/<version>/` 的已发布源码快照

整个系统有两个关键产品约束：

- 只有 `published` 版本会出现在 `/preview`
- 只有源码快照状态为 `ready` 的版本才会通过 MCP 暴露

这意味着预览页和 MCP 都只消费“已经发布完成”的结果，而不会临时触发构建。

## 技术栈

- Next.js App Router
- React 19
- next-intl
- TypeScript
- Prisma 7 与 `@prisma/adapter-better-sqlite3`
- 基于 `data/` 的文件系统存储
- Vitest 测试

## 核心工作流

1. 管理员上传一个 `.zip` 源码压缩包。
2. 平台创建构建任务，并将压缩包解压到 `data/build-jobs/`。
3. 构建任务定位有效项目根目录，安装依赖并执行项目自身的 `build` 脚本。
4. 系统从 `dist/` 校验构建结果。
5. 已发布文件会复制到 `data/prototypes/<userId>/<productKey>/<version>/`。
6. 源码快照会复制到 `data/source-snapshots/<userId>/<productKey>/<version>/`。
7. 版本发布完成后可在 `/preview` 访问；源码快照标记为 `ready` 后可被 MCP 读取。

## 快速开始

### 前置要求

- Node.js 22 或更高版本
- pnpm 10.33 或更高版本
- 如果要走容器部署流程，需要 Docker

### 本地开发

1. 安装依赖。

   ```bash
   pnpm install
   ```

2. 创建本地环境变量文件。

   ```bash
   cp .env.example .env
   ```

   PowerShell 可使用：

   ```powershell
   Copy-Item .env.example .env
   ```

3. 初始化数据库并写入演示数据。

   ```bash
   pnpm prisma:generate
   pnpm db:push
   pnpm db:seed
   ```

   也可以直接使用简写命令：

   ```bash
   pnpm init
   ```

4. 启动开发服务器。

   ```bash
   pnpm dev
   ```

5. 打开应用。

- 中文默认路由：`http://localhost:3000/preview` 和 `http://localhost:3000/admin`
- 英文路由：`http://localhost:3000/en/preview` 和 `http://localhost:3000/en/admin`

无前缀应用路由默认渲染 `zh`，英文页面统一位于 `/en/*`。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm init` | 生成 Prisma Client、推送 schema、写入演示数据 |
| `pnpm test` | 运行带 coverage 的 Vitest 测试 |
| `pnpm typecheck` | 执行 TypeScript 类型检查 |
| `pnpm build` | 构建 Next.js 应用 |
| `pnpm backfill:source-snapshots` | 为历史已发布版本补齐源码快照 |

### Schema 工作流说明

本项目当前以 `pnpm db:push` 作为 schema 初始化流程。
本地开发和运行时行为都不以提交到仓库的 Prisma migrations 作为主要事实来源。

## Docker 部署

1. 从示例文件生成 `.env.docker`。

   ```bash
   cp .env.docker.example .env.docker
   ```

2. 设置关键部署变量：

- `IMAGE_TAG`：生产环境应固定到明确的发布标签 `vX.Y.Z`，例如 `v1.4.0`
- `APP_URL`：应填写用户和 MCP 客户端实际访问到的公网地址
- `APP_PORT`：宿主机映射端口
- `MCP_TOKEN_ENCRYPTION_KEY`：建议配置，用于加密数据库中保存的用户 MCP token

3. 首次部署时先初始化数据库。

   ```bash
   docker compose --env-file .env.docker --profile init run --rm db-init
   ```

4. 如果需要演示数据，再执行种子任务。

   ```bash
   docker compose --env-file .env.docker --profile seed run --rm seed-demo
   ```

5. 启动应用。

   ```bash
   docker compose --env-file .env.docker pull
   docker compose --env-file .env.docker up -d
   ```

### 升级已有部署

1. 备份 `docker-data/sqlite/app.db`。
2. 将 `.env.docker` 中的 `IMAGE_TAG` 更新为目标发布版本。
3. 拉取新镜像。
4. 运行 `db-init` 应用 Prisma schema 变更。
5. 重启应用容器。

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker --profile init run --rm db-init
docker compose --env-file .env.docker up -d
```

`latest` 适合快速体验，但生产环境应固定到明确的发布标签，这样升级和回滚才可预测。
仓库提供的 `compose.yml` 还设置了 `ulimits.nofile=65535`；如果你用其他方式运行容器，也应保持同等级别限制。

部署后的常用访问入口：

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`
- `http://<server>:3000/en/preview`
- `http://<server>:3000/en/admin`

## 接入 MCP 客户端

仓库内置了一个基于已发布源码快照的远程 MCP 接口。

- 接口地址：`POST /api/mcp`
- 鉴权方式：`Authorization: Bearer <用户在设置页创建的 MCP key>`
- Key 管理：在 `/settings` 中为当前账号创建 MCP key，设置过期时间并授权可访问的产品
- 方法约束：`GET /api/mcp` 和 `DELETE /api/mcp` 会明确返回 `405`

大多数 MCP 客户端都可以通过类似下面的配置接入：

```json
{
  "mcpServers": {
    "prototype-source": {
      "url": "https://your-domain.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer replace-with-your-mcp-auth-token"
      }
    }
  }
}
```

本地开发一般使用 `http://localhost:3000/api/mcp`。
如果服务前面有反向代理，请确保它会透传 `Authorization` 请求头。
每个 MCP key 都绑定到单一用户账号，因此工具只能看到该 key 已授权的产品。

### 当前可用 MCP 工具

- `list_products`
- `list_versions`
- `resolve_version`
- `get_source_tree`
- `read_source_file`
- `search_source_files`

如果你的已发布版本早于源码快照功能上线，可以执行：

```bash
pnpm backfill:source-snapshots
```

## 配置参考

### 本地默认值

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma 使用的 SQLite 连接串 |
| `DATA_DIR` | `./data` | SQLite、上传文件、构建任务、静态原型和源码快照的根目录 |
| `UPLOAD_MAX_MB` | `200` | 上传大小上限，单位 MB |
| `APP_URL` | `http://localhost:3000` | 对外访问地址 |
| `MCP_TOKEN_ENCRYPTION_KEY` | `AUTH_SECRET` 回退 | 数据库内 MCP token 的加密密钥 |

### Docker 默认值

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_TAG` | `v1.4.0` | `compose.yml` 使用的发布镜像标签 |
| `APP_URL` | `http://localhost` | 对外访问地址 |
| `APP_PORT` | `3000` | 映射到容器的宿主机端口 |
| `UPLOAD_MAX_MB` | `200` | 上传大小上限，单位 MB |
| `MCP_TOKEN_ENCRYPTION_KEY` | _(空，默认回退到 `AUTH_SECRET`)_ | 数据库内 MCP token 的加密密钥 |

`DATABASE_URL` 仍然是 Prisma CLI 和运行时共享的数据库事实来源。
本地相对 SQLite 路径会先由 `prisma.config.ts` 在 CLI 阶段解析，再由 `lib/prisma.ts` 在运行时标准化。

## 原型上传约束

上传规则是刻意收紧的，目的是保证发布后的预览行为稳定可预测。

- 只接受 `.zip` 上传
- 压缩包中必须包含 `package.json`
- 当前只支持 `pnpm` 和 `npm` 项目
- 项目必须定义 `build` 脚本
- 可发布产物必须来自 `dist/`
- `dist/index.html` 必须使用相对资源路径
- `/assets/...` 这类根绝对路径资源引用会被拒绝

## 仓库结构

```text
app/                    Next.js 页面、路由和 API 处理器
app/[locale]/           zh 和 en 的 locale 路由层
components/             管理台与预览页 UI
components/admin/       管理台 hooks、dialogs、forms、panels
components/preview/     预览列表、产品卡片和全屏预览器
i18n/                   next-intl 路由和请求配置
messages/               多语言文案目录
lib/domain/             业务规则和校验逻辑
lib/server/             构建、上传、manifest、MCP、快照和文件系统服务
lib/ui/                 客户端视图辅助方法和轻量 API 工具
prisma/                 Prisma schema
scripts/                种子和维护脚本
tests/                  按功能领域划分的测试
data/                   运行时数据，不属于源码
```

## 验证与贡献

发起 Pull Request 前，建议至少执行：

```bash
pnpm test
pnpm typecheck
pnpm build
```

如果你在 Windows 上执行 `pnpm build`，Next.js standalone 输出可能要求启用 Developer Mode，或者使用具备符号链接权限的终端。

如果你准备提交代码：

- 保持路由处理器足够薄，把业务规则放进 `lib/domain` 或 `lib/server`
- 行为变更时同步更新对应测试
- 在 Pull Request 中明确说明部署层面或运维层面的影响
- 工作流或配置有变化时同步更新文档

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE)。
