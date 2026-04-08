# Prototype Manage Tool

An open-source, self-hosted platform for publishing and previewing frontend prototypes. It provides a unified preview workspace for product/version switching and an admin workspace for managing uploads, build jobs, publishing state, and default versions.

[简体中文](./README.zh-CN.md) | [MIT License](./LICENSE)

## Overview

Prototype Manage Tool is built for teams that need a simple way to publish static frontend prototypes and browse them by product and version. It combines a Next.js application shell, Prisma-backed metadata storage, and filesystem-based prototype publishing in a single repository.

This repository is suitable for:

- users who want to self-host an internal prototype gallery
- contributors who want to extend the upload, build, and preview workflow

## Features

- Unified preview page at `/preview` for switching between products and published versions
- Admin workspace at `/admin` for creating products, uploading prototype archives, monitoring build jobs, setting defaults, taking versions offline, and deleting records
- API routes for products, versions, manifest resolution, build job status, and preview routing
- Filesystem-based publishing under `/prototypes/*`
- Remote MCP endpoint at `POST /api/mcp` so agents can inspect published source snapshots directly
- Demo seed data for local evaluation
- Docker image publishing workflow for container-based deployment

## Tech Stack

- Next.js App Router
- TypeScript
- Ant Design
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

## Environment Variables

### Local Environment

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `file:../data/sqlite/app.db` | Prisma SQLite connection string |
| `DATA_DIR` | `./data` | Base directory for SQLite, uploads, build jobs, and published prototypes |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `APP_URL` | `http://localhost:3000` | Public application URL |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp`; when empty, MCP endpoint is disabled |

### Docker Environment

| Variable | Default | Description |
| --- | --- | --- |
| `IMAGE_TAG` | `latest` | Docker image tag used by `compose.yml` |
| `APP_URL` | `http://localhost` | Public application URL |
| `APP_PORT` | `3000` | Host port mapped to the container |
| `UPLOAD_MAX_MB` | `200` | Maximum upload size in megabytes |
| `MCP_AUTH_TOKEN` | _(empty)_ | Bearer token for `POST /api/mcp`; when empty, MCP endpoint is disabled |

## Demo Data

Running `pnpm db:seed` creates demo products and published versions so the platform is usable immediately after setup. The current seed includes sample CRM and ERP prototypes.

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
Its job is simple: let an agent read the published prototype source directly, without
downloading a zip file and unpacking it first.

### What the Agent Can Access

- only versions with `status=published` and source snapshot `status=ready`
- directory trees for a published source snapshot
- full text file reads, including line-range reads
- text search inside published source files

### Server Setup

1. Set `MCP_AUTH_TOKEN` in `.env` or `.env.docker`.
2. Make sure `APP_URL` points to the address the agent can actually reach.
3. Deploy the app and keep the `/api/mcp` route reachable over HTTP.
4. If you already had published versions before this feature, run `pnpm backfill:source-snapshots`.

Connection details:

- Endpoint: `POST /api/mcp`
- Transport style: stateless Streamable HTTP
- Authentication: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- Availability: MCP is disabled when `MCP_AUTH_TOKEN` is empty

If you run the app behind a reverse proxy, make sure it forwards the `Authorization`
header to the Next.js app.

Non-POST methods are not supported for MCP operations:

- `GET /api/mcp` returns `405`
- `DELETE /api/mcp` returns `405`

### Agent Configuration

Many MCP clients let you register a remote server with an `mcpServers` JSON block.
Use your own public URL and token:

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

Some clients require an explicit transport object instead of a top-level `url`:

```json
{
  "mcpServers": {
    "prototype-source": {
      "transport": {
        "type": "streamable-http",
        "url": "https://your-domain.example.com/api/mcp",
        "headers": {
          "Authorization": "Bearer replace-with-your-mcp-auth-token"
        }
      }
    }
  }
}
```

Use whichever format your agent supports. The three values that matter are the same:

- remote URL: `https://<your-app>/api/mcp`
- transport: Streamable HTTP
- auth header: `Authorization: Bearer <MCP_AUTH_TOKEN>`

### Recommended Agent Flow

When you want the agent to understand a specific prototype version, this is the most
useful call sequence:

1. Call `resolve_version` with `selector=default`, `selector=latest`, or `exactVersion`.
2. Call `get_source_tree` to inspect the root tree or a subdirectory.
3. Call `read_source_file` for the exact files the agent needs to inspect.
4. Call `search_source_files` when the agent needs to locate routes, UI text, API mocks, or domain terms.

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

This command scans published versions, restores their source archives, and generates missing source snapshots.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local development server |
| `pnpm build` | Build the Next.js app |
| `pnpm start` | Start the production server |
| `pnpm test` | Run the Vitest suite |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm prisma:generate` | Generate the Prisma client |
| `pnpm prisma:migrate` | Create and apply a Prisma migration in development |
| `pnpm db:push` | Push the Prisma schema to the SQLite database |
| `pnpm db:seed` | Seed demo products and versions |
| `pnpm init` | Generate Prisma client, push schema, and seed demo data |
| `pnpm backfill:source-snapshots` | Backfill missing source snapshots for published versions |

## Docker Deployment

The repository ships with a container image and a `compose.yml` file for self-hosted deployment.

### Files You Need

- `compose.yml`
- `.env.docker`
- `docker-data/`

Create `.env.docker` from `.env.docker.example`, then adjust:

- `APP_URL`
- `APP_PORT`
- `IMAGE_TAG`
- `MCP_AUTH_TOKEN`

By default, persistent data is mounted to `./docker-data` and mapped to `/app/data` inside the container. This includes:

- SQLite database at `/app/data/sqlite/app.db`
- published prototypes at `/app/data/prototypes`
- temporary uploads at `/app/data/uploads-temp`
- build job workspaces at `/app/data/build-jobs`

### Initialize the Database

```bash
docker compose --env-file .env.docker --profile init run --rm db-init
```

If you also want demo data:

```bash
docker compose --env-file .env.docker --profile seed run --rm seed-demo
```

### Start the Application

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

The default entry points are:

- `http://<server>:3000/preview`
- `http://<server>:3000/admin`

### Open File Limit Requirement

The provided `compose.yml` sets `ulimits.nofile=65535`. If you run the container in another way, set the same limit explicitly. Otherwise, uploaded Vite or Tailwind projects may fail during dependency resolution with misleading build errors.

### Upgrade or Roll Back

Change `IMAGE_TAG` in `.env.docker`, then run:

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d
```

Persistent data in `docker-data/` is not replaced during image upgrades.

## Docker Image Publishing

This repository includes a GitHub Actions workflow at `.github/workflows/docker-publish.yml` that publishes the runtime image to Docker Hub:

- image repository: `horizon2333/prototype-manage-tool`
- `latest` for the `main` branch
- `v*` tags for release tags

To use the workflow, configure these repository secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Repository Structure

```text
app/                    Next.js pages, routes, and API handlers
components/             Admin and preview UI components
lib/                    Configuration, domain logic, and server utilities
prisma/                 Prisma schema
scripts/                Seed and supporting scripts
tests/                  Unit tests for core behaviors
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

## Contributing

Contributions are welcome. For changes that affect the upload, build, preview, or publishing flow:

- keep behavior changes scoped and documented
- add or update tests in `tests/` when logic changes
- describe operational impact clearly in your pull request
- verify local setup or Docker behavior when deployment-related files are touched

If you are unsure where to start, reviewing the API routes in `app/api/` and the server logic in `lib/server/` is usually the fastest way to understand the system.

## Project Status

This project is functional but still early-stage. Expect the data model, admin workflow, and deployment details to keep evolving.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
