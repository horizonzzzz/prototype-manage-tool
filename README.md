# Prototype Manage Tool

Prototype Manage Tool is a self-hosted platform for publishing static frontend prototypes by product and version.
It gives teams three working surfaces:

- `/preview` to browse published prototypes and switch product/version
- `/admin` to upload source archives, monitor build jobs, publish or offline versions, and manage defaults
- `POST /api/mcp` to let agents inspect published source snapshots over MCP

[简体中文](./README.zh-CN.md) | [MIT License](./LICENSE)

## What It Is

The application stores and serves three different kinds of state:

- metadata in SQLite through Prisma
- published static artifacts in `data/prototypes/<productKey>/<version>/`
- published source snapshots in `data/source-snapshots/<productKey>/<version>/`

Two product rules shape the whole system:

- only `published` versions appear in `/preview`
- MCP only exposes versions whose source snapshot status is `ready`

This means preview and MCP both read from already-published outputs. They do not build prototypes on demand.

## Tech Stack

- Next.js App Router
- React 19
- next-intl
- TypeScript
- Prisma 7 with SQLite via `@prisma/adapter-better-sqlite3`
- filesystem-backed storage under `data/`
- Vitest for tests

## How It Works

1. An admin uploads a `.zip` source archive.
2. The platform creates a build job and extracts the archive into `data/build-jobs/`.
3. The build job locates the effective project root, installs dependencies, and runs the project's `build` script.
4. The build output is validated from `dist/`.
5. Published files are copied into `data/prototypes/<productKey>/<version>/`.
6. A source snapshot is copied into `data/source-snapshots/<productKey>/<version>/`.
7. The version becomes available to `/preview`, and the source snapshot becomes available to MCP after it is marked `ready`.

## Quick Start

### Prerequisites

- Node.js 22 or newer
- pnpm 10.33 or newer
- Docker, if you want to use the containerized deployment flow

### Local Development

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create a local environment file.

   ```bash
   cp .env.example .env
   ```

   PowerShell equivalent:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Initialize the database and demo data.

   ```bash
   pnpm prisma:generate
   pnpm db:push
   pnpm db:seed
   ```

   Short form:

   ```bash
   pnpm init
   ```

4. Start the development server.

   ```bash
   pnpm dev
   ```

5. Open the app.

- Chinese default routes: `http://localhost:3000/preview` and `http://localhost:3000/admin`
- English routes: `http://localhost:3000/en/preview` and `http://localhost:3000/en/admin`

Unprefixed app routes render `zh`. English routes live under `/en/*`.

### Common Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm init` | Generate Prisma client, push schema, and seed demo data |
| `pnpm test` | Run the Vitest suite with coverage |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm build` | Build the Next.js app |
| `pnpm backfill:source-snapshots` | Create missing source snapshots for already-published versions |

### Schema Workflow Note

This project currently initializes schema with `pnpm db:push`.
Checked-in Prisma migrations are not the primary source of truth for local setup or runtime behavior.

## Docker Deployment

1. Create `.env.docker` from the example file.

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Set the deployment values you care about:

- `IMAGE_TAG` should be pinned to a released `vX.Y.Z` tag in production, for example `v1.4.0`
- `APP_URL` should match the public URL users and MCP clients will reach
- `APP_PORT` controls the host port
- `MCP_AUTH_TOKEN` enables remote MCP access

3. Initialize the database on first deployment.

   ```bash
   docker compose --env-file .env.docker --profile init run --rm db-init
   ```

4. Seed demo data if you want sample products.

   ```bash
   docker compose --env-file .env.docker --profile seed run --rm seed-demo
   ```

5. Start the application.

   ```bash
   docker compose --env-file .env.docker pull
   docker compose --env-file .env.docker up -d
   ```

### Upgrade An Existing Deployment

1. Back up `docker-data/sqlite/app.db`.
2. Update `IMAGE_TAG` in `.env.docker` to the target release tag.
3. Pull the new image.
4. Run `db-init` so Prisma schema changes are applied.
5. Restart the app containers.

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker --profile init run --rm db-init
docker compose --env-file .env.docker up -d
```

`latest` is still convenient for evaluation, but production deployments should stay pinned to a specific release tag so upgrades and rollbacks are predictable.
The provided `compose.yml` also keeps `ulimits.nofile=65535`; keep the same limit if you run the container another way.

Typical entry points after deployment:

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`
- `http://<server>:3000/en/preview`
- `http://<server>:3000/en/admin`

## Connect An MCP Client

The repository exposes a remote MCP endpoint backed by published source snapshots.

- Endpoint: `POST /api/mcp`
- Authentication: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- Availability: when `MCP_AUTH_TOKEN` is empty, the endpoint returns `503`
- Method contract: `GET /api/mcp` and `DELETE /api/mcp` intentionally return `405`

Most MCP clients can register the server with a block like this:

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

Use `http://localhost:3000/api/mcp` for local development unless you have real HTTPS configured.
If you deploy behind a reverse proxy, make sure it forwards the `Authorization` header.

### Available MCP Tools

- `list_products`
- `list_versions`
- `resolve_version`
- `get_source_tree`
- `read_source_file`
- `search_source_files`

If you already had published versions before source snapshots existed, run:

```bash
pnpm backfill:source-snapshots
```

## Configuration Reference

### Local Defaults

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma SQLite connection string |
| `DATA_DIR` | `./data` | Base directory for SQLite, uploads, build jobs, published prototypes, and source snapshots |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `APP_URL` | `http://localhost:3000` | Public application URL |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp` |

### Docker Defaults

| Variable | Default | Purpose |
| --- | --- | --- |
| `IMAGE_TAG` | `v1.4.0` | Released image tag used by `compose.yml` |
| `APP_URL` | `http://localhost` | Public application URL |
| `APP_PORT` | `3000` | Host port mapped to the container |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp` |

`DATABASE_URL` remains the database source of truth for both Prisma CLI commands and runtime access.
Relative local SQLite URLs are resolved via `prisma.config.ts` for CLI usage and normalized again in `lib/prisma.ts` at runtime.

## Prototype Upload Contract

Uploads are intentionally strict so published previews stay predictable.

- only `.zip` uploads are accepted
- the archive must contain `package.json`
- only `pnpm` and `npm` projects are supported
- the project must define a `build` script
- publishable output must come from `dist/`
- `dist/index.html` must use relative asset paths
- root-absolute asset references such as `/assets/...` are rejected

## Repository Map

```text
app/                    Next.js pages, routes, and API handlers
app/[locale]/           Locale-aware routes for zh and en
components/             Admin and preview UI
components/admin/       Admin hooks, dialogs, forms, and panels
components/preview/     Preview list, product cards, and fullscreen viewer
i18n/                   next-intl routing and request configuration
messages/               Translation catalogs
lib/domain/             Business rules and validation helpers
lib/server/             Build, upload, manifest, MCP, snapshot, and filesystem services
lib/ui/                 Client-side view helpers and lightweight API utilities
prisma/                 Prisma schema
scripts/                Seed and maintenance scripts
tests/                  Tests grouped by product area
data/                   Runtime data, not source code
```

## Verification And Contribution

Before opening a pull request, run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

If you run `pnpm build` on Windows, Next.js standalone output may require Developer Mode or an elevated shell so symlink creation succeeds.

If you contribute changes:

- keep route handlers thin and push business rules into `lib/domain` or `lib/server`
- update matching tests when behavior changes
- call out deployment or operator-facing impact in your pull request
- update documentation when workflow or configuration changes

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
