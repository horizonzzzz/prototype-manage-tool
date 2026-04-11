# Prototype Manage Tool

An open-source, self-hosted platform for publishing and previewing frontend prototypes. It provides a unified preview workspace for product/version switching and an admin workspace for managing uploads, build jobs, publishing state, and default versions.

[简体中文](./README.zh-CN.md) | [MIT License](./LICENSE)

## Features

- Prototype-style workspace shell with sidebar navigation and top-bar theme controls across preview and admin surfaces
- Shared shadcn-style cards, tables, dialogs, auth pages, and placeholder pages aligned to the current workspace UI
- Unified preview center at `/preview` with card-based product/version selection and published-version switching
- Fullscreen preview dialog with desktop/tablet/mobile viewport toggles and deep-linkable `/preview/:product?v=:version` state
- Admin workspace at `/admin` with paginated product/version management, upload controls, build-job monitoring, default/offline actions, and delete operations
- Auth/account placeholder routes at `/login`, `/register`, `/users`, and `/settings`, now rendered through the shared locale-aware UI
- Internationalized routing via `next-intl` with `zh` as the default locale and `/en/*` routes for English pages
- Language switching exposed on auth pages and in `/settings`, with route-level locale switching instead of browser-local language storage
- Theme switching exposed as `light` / `dark` / `system` while staying local-only in this phase
- API routes for products, versions, manifest resolution, build job status, and preview routing
- Filesystem-based publishing under `/prototypes/*`
- Remote MCP endpoint at `POST /api/mcp` so agents can inspect published source snapshots directly
- Demo seed data for local evaluation
- Docker image publishing workflow for container-based deployment

## Tech Stack

- Next.js App Router
- next-intl
- TypeScript
- Tailwind CSS v4
- shadcn/ui primitives
- Prisma
- SQLite
- Local filesystem storage for published artifacts

## Quick Start

### Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer
- Docker, if you want to run the containerized setup

### Local Development

1. Install dependencies:

```bash
pnpm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Initialize Prisma and seed demo data:

```bash
pnpm prisma:generate
pnpm db:push
pnpm db:seed
```

4. Start the development server:

```bash
pnpm dev
```

5. Open the app:

- Preview workspace: `http://localhost:3000/preview`
- Admin workspace: `http://localhost:3000/admin`
- English preview workspace: `http://localhost:3000/en/preview`
- English admin workspace: `http://localhost:3000/en/admin`

The seed data includes sample CRM and ERP prototypes.

## Configuration

## Routing And Localization

- Locale routing is implemented with `next-intl`
- Supported locales: `zh`, `en`
- Default locale: `zh`
- Locale prefix mode: `as-needed`
- Unprefixed routes like `/admin`, `/preview`, `/login`, and `/settings` render Chinese
- English pages are available under `/en/*`, for example `/en/admin`, `/en/preview`, and `/en/login`
- The language switcher changes the current route locale; it does not use `localStorage` or a custom language cookie anymore

### Local

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma SQLite connection string |
| `DATA_DIR` | `./data` | Base directory for SQLite, uploads, build jobs, and published prototypes |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `APP_URL` | `http://localhost:3000` | Public application URL |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp`; when empty, MCP endpoint is disabled |

### Docker

| Variable | Default | Description |
| --- | --- | --- |
| `IMAGE_TAG` | `latest` | Docker image tag used by `compose.yml` |
| `APP_URL` | `http://localhost` | Public application URL |
| `APP_PORT` | `3000` | Host port mapped to the container |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp`; when empty, MCP endpoint is disabled |

## How Prototype Uploads Work

The platform accepts a source archive, installs dependencies, runs the prototype build, validates the generated output, and publishes the result into the data directory.

Current constraints:

- only `.zip` uploads are accepted
- the archive must contain a `package.json`
- only `pnpm` and `npm` projects are currently supported
- the project must define a `build` script
- the build output must be published from `dist/`
- `dist/index.html` must use relative asset paths
- root-absolute asset references such as `/assets/...` are rejected

## MCP Source Snapshots

The repository includes a remote MCP endpoint backed by `@modelcontextprotocol/sdk`.
It lets an agent inspect published prototype source directly.

- only versions with `status=published` and source snapshot `status=ready`
- directory trees for a published source snapshot
- full text file reads, including line-range reads
- text search inside published source files

- Endpoint: `POST /api/mcp`
- Transport style: stateless Streamable HTTP
- Authentication: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- Availability: MCP is disabled when `MCP_AUTH_TOKEN` is empty

### Agent Configuration

Most MCP clients can register the endpoint with a JSON block like this:

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

- `list_products`: list products that currently have published source snapshots
- `list_versions`: list published source-snapshot versions for a product
- `resolve_version`: resolve a product version via `default`, `latest`, or exact version
- `get_source_tree`: read directory/file tree from a published source snapshot
- `read_source_file`: read text file content from a published source snapshot
- `search_source_files`: search text in published source snapshot files

### Backfill Source Snapshots

If published versions existed before source snapshots were introduced, run:

```bash
pnpm backfill:source-snapshots
```

## Available Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Build the Next.js app |
| `pnpm start` | Start the production server |
| `pnpm test` | Run the Vitest suite with coverage output |
| `pnpm test:run` | Run the Vitest suite without coverage |
| `pnpm test:coverage` | Run the Vitest suite with coverage output |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm prisma:generate` | Generate the Prisma client |
| `pnpm prisma:migrate` | Create and apply a Prisma migration in development |
| `pnpm db:push` | Push the Prisma schema to the SQLite database |
| `pnpm db:seed` | Seed demo products and versions |
| `pnpm init` | Generate Prisma client, push schema, and seed demo data |
| `pnpm backfill:source-snapshots` | Backfill missing source snapshots for published versions |

## Docker Deployment

The repository ships with a container image and `compose.yml` for self-hosted deployment.
Create `.env.docker` from `.env.docker.example`, then adjust:

- `APP_URL`
- `APP_PORT`
- `IMAGE_TAG`
- `MCP_AUTH_TOKEN`

Initialize the database:

```bash
docker compose --env-file .env.docker --profile init run --rm db-init
```

Seed demo data if needed:

```bash
docker compose --env-file .env.docker --profile seed run --rm seed-demo
```

Start the application:

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

Default entry points:

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`
- `http://<server>:3000/en/preview`
- `http://<server>:3000/en/admin`

The provided `compose.yml` sets `ulimits.nofile=65535`. Keep the same limit if you run the container another way.

## Repository Structure

```text
app/                    Next.js pages, routes, and API handlers
i18n/                   next-intl routing, navigation, and request configuration
messages/               Locale message catalogs for zh and en
components/             Admin and preview UI components
components/admin/       Admin UI grouped into dialogs, forms, hooks, pages, and panels
components/preview/     Preview list, product cards, and fullscreen viewer dialog
lib/                    Configuration, domain logic, and server utilities
prisma/                 Prisma schema
scripts/                Seed and supporting scripts
tests/                  Tests grouped by domain, for example admin, preview, build-jobs, routes, and upload
data/                   Local SQLite database, uploads, and published prototypes
docker/                 Container entrypoint and Docker-related files
public/                 Static assets
```

## Testing

Run the main verification commands before opening a pull request:

```bash
pnpm test
pnpm typecheck
pnpm build
```

On Windows, `pnpm build` uses Next.js `output: 'standalone'` and may require Developer Mode or an elevated shell so symlink creation succeeds.

## Contributing

Contributions are welcome.

- keep behavior changes scoped and documented
- add or update tests in the matching `tests/<domain>/` folder when logic changes
- describe operational impact clearly in your pull request
- verify local setup or Docker behavior when deployment-related files are touched

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
