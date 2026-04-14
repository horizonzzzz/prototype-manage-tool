# Prototype Manage Tool

Self-hosted platform for publishing static frontend prototypes by product and version.

It provides three surfaces:

- `/preview` for browsing published prototypes
- `/admin` for uploading source archives, tracking build jobs, and managing versions
- `POST /api/mcp` for exposing published source snapshots to MCP clients

[简体中文](./README.zh-CN.md) | [MIT License](./LICENSE)

## Overview

Prototype Manage Tool is built for teams that want a lightweight way to publish internal frontend prototypes without standing up a full preview platform.

Key behaviors:

- every product, version, build job, and MCP key is owned by a user account
- previews only serve already published static output
- MCP only exposes published versions whose source snapshot status is `ready`
- published files and source snapshots are stored separately for serving and code inspection

Under the hood, the app stores:

- metadata in SQLite through Prisma
- published artifacts in `data/prototypes/<userId>/<productKey>/<version>/`
- source snapshots in `data/source-snapshots/<userId>/<productKey>/<version>/`

## Features

- Upload a `.zip` frontend project and build it with `pnpm` or `npm`
- Publish product versions and manage default or offline states
- Browse published versions from a dedicated preview UI
- Expose published source trees through a remote MCP endpoint
- Support `zh` and `en` routes with `next-intl`

> [!NOTE]
> The platform does not build previews on demand. Uploads are processed as build jobs, and preview/MCP read from already published outputs.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- next-intl
- Prisma 7 with SQLite
- Filesystem-backed artifact storage
- Vitest

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10.33+

### Local Development

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create the local environment file.

   ```bash
   cp .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Initialize Prisma and seed demo data.

   ```bash
   pnpm init
   ```

4. Start the app.

   ```bash
   pnpm dev
   ```

5. Open:

- `http://localhost:3000/preview`
- `http://localhost:3000/admin`
- `http://localhost:3000/en/preview`
- `http://localhost:3000/en/admin`

> [!TIP]
> Unprefixed routes default to `zh`. English routes live under `/en/*`.

## Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm init` | Generate Prisma client, push schema, and seed demo data |
| `pnpm test` | Run the test suite |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm build` | Build the app |

## Docker

1. Create the Docker env file.

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Set at least:

- `IMAGE_TAG` to a released `vX.Y.Z` tag for production
- `APP_URL` to the public app URL
- `AUTH_SECRET` to a long random secret
- `MCP_TOKEN_ENCRYPTION_KEY` if you want stable MCP token encryption

3. Initialize the database.

   ```bash
   docker compose --env-file .env.docker --profile init run --rm db-init
   ```

4. Optionally seed demo data.

   ```bash
   docker compose --env-file .env.docker --profile seed run --rm seed-demo
   ```

5. Start the application.

   ```bash
   docker compose --env-file .env.docker pull
   docker compose --env-file .env.docker up -d
   ```

> [!IMPORTANT]
> This project uses `pnpm db:push` as the schema workflow. Checked-in Prisma migrations are not the local setup source of truth.

## MCP Endpoint

The app exposes a remote MCP server over HTTP:

- endpoint: `POST /api/mcp`
- auth: `Authorization: Bearer <user-scoped MCP key>`
- key management: create keys from `/settings` and authorize products per key
- method contract: `GET /api/mcp` and `DELETE /api/mcp` return `405`

Example client config:

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

Available tools:

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
- `get_source_index_status`

## Upload Rules

Uploads are intentionally strict:

- only `.zip` archives are accepted
- the archive must include `package.json`
- only `pnpm` and `npm` projects are supported
- the project must define a `build` script
- publishable output must come from `dist/`
- `dist/index.html` must use relative asset paths

## Project Layout

```text
app/                    Next.js routes and API handlers
components/             Admin, preview, layout, and UI components
i18n/                   Locale routing and request configuration
lib/domain/             Business rules and validation helpers
lib/server/             Build, upload, manifest, MCP, and snapshot services
lib/ui/                 Client-side view helpers
prisma/                 Prisma schema and configuration
scripts/                Seed and maintenance scripts
tests/                  Vitest suites
data/                   Runtime data directory
```

## Verification

Run these before opening a PR:

```bash
pnpm test
pnpm typecheck
pnpm build
```

On Windows, `pnpm build` may require Developer Mode or an elevated shell so Next.js can create symlinks for standalone output.
