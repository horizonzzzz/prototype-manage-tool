# Prototype Manage Tool

一个开源、自托管的前端原型发布与预览平台，提供统一的产品/版本预览入口，以及用于管理上传、构建任务、发布状态和默认版本的后台工作台。

[English](./README.md) | [MIT License](./LICENSE)

## 核心能力

- 提供原型风格的工作区外壳，在预览与管理页面统一使用侧边导航和顶部主题/语言切换控件
- 统一使用当前工作台风格的 shadcn 卡片、表格、弹窗、认证页与占位页基础组件
- 在 `/preview` 提供卡片式预览中心，支持按产品和已发布版本切换
- 提供全屏预览弹层，支持桌面 / 平板 / 手机视图切换，以及 `/preview/:product?v=:version` 深链接状态
- 在 `/admin` 提供分页化的产品/版本管理界面，支持上传、构建任务监控、默认版本设置、下线和删除操作
- 预留 `/login`、`/register`、`/users`、`/settings` 占位路由，用于后续接入认证与账号管理能力
- 当前阶段提供 `light` / `dark` / `system` 三档本地主题切换，不改变真实认证和多语言路由约定
- 提供产品、版本、manifest 解析、构建任务状态和预览路由等 API
- 通过 `/prototypes/*` 提供基于文件系统的静态原型访问
- 提供远程 `POST /api/mcp` MCP 接口，便于 agent 直接读取已发布版本的源码快照
- 提供可直接体验的演示种子数据
- 提供面向 Docker 部署的镜像发布工作流

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui 基础组件
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

种子数据会创建 CRM 和 ERP 示例原型。

## 配置

### 本地

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma 使用的 SQLite 连接串 |
| `DATA_DIR` | `./data` | SQLite、上传文件、构建任务和发布产物的根目录 |
| `UPLOAD_MAX_MB` | `200` | 上传文件大小上限，单位 MB |
| `APP_URL` | `http://localhost:3000` | 对外访问地址 |
| `MCP_AUTH_TOKEN` | _(空)_ | `POST /api/mcp` 的 Bearer Token；为空时 MCP 接口禁用 |

### Docker

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IMAGE_TAG` | `latest` | `compose.yml` 使用的镜像标签 |
| `APP_URL` | `http://localhost` | 对外访问地址 |
| `APP_PORT` | `3000` | 宿主机映射端口 |
| `UPLOAD_MAX_MB` | `200` | 上传文件大小上限，单位 MB |
| `MCP_AUTH_TOKEN` | _(空)_ | `POST /api/mcp` 的 Bearer Token；为空时 MCP 接口禁用 |

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

仓库内置了基于 `@modelcontextprotocol/sdk` 的远程 MCP 接口，供 agent 直接读取已发布原型源码。

- 仅 `status=published` 且源码快照 `status=ready` 的版本
- 已发布源码快照的目录树
- 文本文件的完整读取，以及按行范围读取
- 已发布源码文件内的全文搜索

- 接口地址：`POST /api/mcp`
- 传输方式：无状态 Streamable HTTP
- 鉴权方式：`Authorization: Bearer <MCP_AUTH_TOKEN>`
- 可用条件：`MCP_AUTH_TOKEN` 为空时 MCP 接口返回禁用状态

### Agent 侧配置

大多数 MCP 客户端都支持通过 `mcpServers` JSON 注册远程服务。将下面的 URL 和 Token 替换为你自己的：

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

本地开发通常应使用 `http://localhost:3000/api/mcp`。只有在你确实配置了 HTTPS 时才使用 `https://`。
如果前面有反向代理，请确认它会透传 `Authorization` 请求头。

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

## 可用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 构建 Next.js 应用 |
| `pnpm start` | 启动生产服务器 |
| `pnpm test` | 运行带 coverage 输出的 Vitest 测试 |
| `pnpm test:run` | 运行不带 coverage 的 Vitest 测试 |
| `pnpm test:coverage` | 运行带 coverage 输出的 Vitest 测试 |
| `pnpm test:watch` | 以 watch 模式运行 Vitest |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm prisma:generate` | 生成 Prisma Client |
| `pnpm prisma:migrate` | 在开发环境创建并应用 Prisma migration |
| `pnpm db:push` | 将 Prisma schema 推送到 SQLite 数据库 |
| `pnpm db:seed` | 写入演示产品和版本 |
| `pnpm init` | 生成 Prisma Client、推送 schema 并写入演示数据 |
| `pnpm backfill:source-snapshots` | 为已发布版本回填缺失的源码快照 |

## Docker 部署

仓库提供了运行镜像和 `compose.yml`，可用于自托管部署。先从 `.env.docker.example` 复制出 `.env.docker`，再按实际情况调整：

- `APP_URL`
- `APP_PORT`
- `IMAGE_TAG`
- `MCP_AUTH_TOKEN`

初始化数据库：

```bash
docker compose --env-file .env.docker --profile init run --rm db-init
```

如果还需要演示数据：

```bash
docker compose --env-file .env.docker --profile seed run --rm seed-demo
```

启动应用：

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

默认访问入口：

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`

仓库里的 `compose.yml` 已设置 `ulimits.nofile=65535`。如果你用其他方式运行容器，请保持相同限制。

## 仓库结构

```text
app/                    Next.js 页面、路由与 API 处理器
components/             管理台和预览页 UI 组件
components/admin/       按 dialogs、forms、hooks、pages、panels 分层的管理台组件
components/preview/     预览列表、产品卡片与全屏预览弹层
lib/                    配置、领域逻辑与服务端工具
prisma/                 Prisma schema
scripts/                种子与辅助脚本
tests/                  按 admin、preview、build-jobs、routes、upload 等领域划分的测试
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

如果在 Windows 上执行 `pnpm build`，由于 Next.js `output: 'standalone'` 需要创建符号链接，通常需要启用 Developer Mode 或使用具备相应权限的终端。

## 贡献说明

欢迎贡献。

- 将行为变化控制在清晰可说明的范围内
- 逻辑有变更时同步补充或更新对应 `tests/<领域>/` 目录下的测试
- 在 Pull Request 中明确说明运行和部署层面的影响
- 如果修改了部署相关文件，补充验证本地或 Docker 行为

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE)。
