# Prototype Manage Tool

一个按产品和版本发布静态前端原型的自托管平台。

它提供三个主要入口：

- `/preview`：浏览已发布原型
- `/admin`：上传源码压缩包、跟踪构建任务、管理版本
- `POST /api/mcp`：向 MCP 客户端暴露已发布版本的源码快照

[English](./README.md) | [MIT License](./LICENSE)

## 概览

Prototype Manage Tool 适合需要在内部快速发布前端原型、但不想搭建完整预览平台的团队。

核心行为：

- 每个产品、版本、构建任务和 MCP key 都归属于某个用户账号
- 预览页只读取已经发布完成的静态产物
- MCP 只暴露源码快照状态为 `ready` 的已发布版本
- 已发布文件和源码快照分开存储，分别服务于预览和源码检索

系统底层会持久化：

- 通过 Prisma 管理的 SQLite 元数据
- 位于 `data/prototypes/<userId>/<productKey>/<version>/` 的已发布产物
- 位于 `data/source-snapshots/<userId>/<productKey>/<version>/` 的源码快照

## 功能

- 上传 `.zip` 前端项目，并使用 `pnpm` 或 `npm` 完成构建
- 发布版本，并管理默认版本或下线状态
- 在独立预览页中浏览已发布版本
- 通过远程 MCP 接口暴露源码树
- 通过 `next-intl` 支持 `zh` 和 `en` 路由

> [!NOTE]
> 平台不会按需构建预览。上传后会先生成构建任务，预览页和 MCP 都只读取已经发布的结果。

## 技术栈

- Next.js App Router
- React 19
- TypeScript
- next-intl
- Prisma 7 + SQLite
- 基于文件系统的产物存储
- Vitest

## 快速开始

### 前置要求

- Node.js 22+
- pnpm 10.33+

### 本地开发

1. 安装依赖。

   ```bash
   pnpm install
   ```

2. 创建本地环境变量文件。

   ```bash
   cp .env.example .env
   ```

   PowerShell：

   ```powershell
   Copy-Item .env.example .env
   ```

3. 初始化 Prisma 并写入演示数据。

   ```bash
   pnpm init
   ```

4. 启动应用。

   ```bash
   pnpm dev
   ```

5. 打开：

- `http://localhost:3000/preview`
- `http://localhost:3000/admin`
- `http://localhost:3000/en/preview`
- `http://localhost:3000/en/admin`

> [!TIP]
> 无前缀路由默认使用 `zh`，英文页面位于 `/en/*`。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm init` | 生成 Prisma Client、推送 schema 并写入演示数据 |
| `pnpm test` | 运行测试 |
| `pnpm typecheck` | 执行 TypeScript 检查 |
| `pnpm build` | 构建应用 |

## Docker

1. 创建 Docker 环境文件。

   ```bash
   cp .env.docker.example .env.docker
   ```

2. 至少配置以下变量：

- `IMAGE_TAG`：生产环境固定到某个发布标签 `vX.Y.Z`
- `APP_URL`：应用对外访问地址
- `AUTH_SECRET`：一个足够长的随机密钥
- `MCP_TOKEN_ENCRYPTION_KEY`：如果希望 MCP token 使用稳定密钥加密则应配置

3. 初始化数据库。

   ```bash
   docker compose --env-file .env.docker --profile init run --rm db-init
   ```

4. 如有需要，写入演示数据。

   ```bash
   docker compose --env-file .env.docker --profile seed run --rm seed-demo
   ```

5. 启动应用。

   ```bash
   docker compose --env-file .env.docker pull
   docker compose --env-file .env.docker up -d
   ```

> [!IMPORTANT]
> 本项目使用 `pnpm db:push` 作为 schema 工作流。提交到仓库的 Prisma migrations 不是本地初始化的事实来源。

## MCP 接口

应用通过 HTTP 暴露远程 MCP 服务：

- 接口：`POST /api/mcp`
- 鉴权：`Authorization: Bearer <用户级 MCP key>`
- Key 管理：在 `/settings` 创建 key，并为其授权可访问的产品
- 方法约束：`GET /api/mcp` 和 `DELETE /api/mcp` 会返回 `405`

示例客户端配置：

```json
{
  "mcpServers": {
    "prototype-source": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer replace-with-your-mcp-token"
      }
    }
  }
}
```

当前可用工具：

- `list_products`
- `list_versions`
- `resolve_version`
- `get_source_tree`
- `read_source_file`
- `search_source_files`
- `get_codebase_summary`
- `search_with_context`
- `get_component_context`
- `get_type_definitions`
- `get_mock_data`
- `get_source_index_status`

## 上传约束

上传规则保持严格：

- 只接受 `.zip` 压缩包
- 压缩包必须包含 `package.json`
- 当前只支持 `pnpm` 和 `npm` 项目
- 项目必须定义 `build` 脚本
- 可发布产物必须来自 `dist/`
- `dist/index.html` 必须使用相对资源路径

## 项目结构

```text
app/                    Next.js 路由和 API 处理器
components/             管理台、预览、布局和 UI 组件
i18n/                   国际化路由和请求配置
lib/domain/             业务规则与校验逻辑
lib/server/             构建、上传、manifest、MCP 和快照服务
lib/ui/                 客户端视图辅助方法
prisma/                 Prisma schema 和配置
scripts/                种子与维护脚本
tests/                  Vitest 测试
data/                   运行时数据目录
```

## 验证

提交 PR 前建议运行：

```bash
pnpm test
pnpm typecheck
pnpm build
```

在 Windows 上，`pnpm build` 可能需要启用 Developer Mode，或者使用具备符号链接权限的终端，以便 Next.js 创建 standalone 输出所需的 symlink。
