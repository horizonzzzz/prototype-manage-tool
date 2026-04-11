# AGENTS.md

This file is a working guide for coding agents operating in this repository.
It is intentionally more implementation-focused than `README.md`.

## Project Summary

Prototype Manage Tool is a self-hosted platform for publishing static frontend prototypes by product and version.

There are two primary user-facing surfaces:

- `/preview`: browse published prototypes and switch product/version
- `/admin`: create products, upload source archives, monitor build jobs, publish versions, set defaults, take versions offline, delete products or versions

There is also a remote MCP surface:

- `POST /api/mcp`: exposes published source snapshots so an agent can inspect source code directly

## Stack

- Next.js App Router
- React 19
- next-intl
- TypeScript
- Prisma with SQLite
- Filesystem-backed storage under `data/`
- Vitest for tests

## Core Runtime Model

The system has three persistent layers:

1. Prisma metadata in SQLite
2. Published prototype files in `data/prototypes/<productKey>/<version>/`
3. Published source snapshots in `data/source-snapshots/<productKey>/<version>/`

Uploads are processed as build jobs. A successful job produces:

- a published static prototype
- an archived source upload path on the job record
- a source snapshot copied from the resolved project root

The application currently initializes schema with `pnpm db:push`, not a checked-in migration workflow.
Do not assume `prisma/migrations/` is part of the committed source of truth.

## Important Directories

- [app](/D:/Work/prototype-manage-tool/app): Next.js routes and pages
- [app/[locale]](/D:/Work/prototype-manage-tool/app/[locale]): locale-aware route segment for `zh` and `en`
- [components](/D:/Work/prototype-manage-tool/components): admin and preview UI
- [i18n](/D:/Work/prototype-manage-tool/i18n): next-intl routing, navigation, and request config
- [messages](/D:/Work/prototype-manage-tool/messages): translation catalogs
- [components/admin/hooks](/D:/Work/prototype-manage-tool/components/admin/hooks): admin-only data loading and build-log coordination hooks
- [components/admin/panels](/D:/Work/prototype-manage-tool/components/admin/panels): admin list and version-management presentation blocks
- [components/admin/dialogs](/D:/Work/prototype-manage-tool/components/admin/dialogs): admin modal and drawer surfaces
- [components/admin/forms](/D:/Work/prototype-manage-tool/components/admin/forms): admin form fields and zod/react-hook-form schemas
- [lib/domain](/D:/Work/prototype-manage-tool/lib/domain): business rules and validation helpers
- [lib/server](/D:/Work/prototype-manage-tool/lib/server): build, upload, manifest, MCP, snapshot, and filesystem services
- [lib/ui](/D:/Work/prototype-manage-tool/lib/ui): client-side view helpers, navigation, and lightweight API utilities
- [prisma/schema.prisma](/D:/Work/prototype-manage-tool/prisma/schema.prisma): database schema
- [scripts](/D:/Work/prototype-manage-tool/scripts): seed and source-snapshot backfill scripts
- [tests](/D:/Work/prototype-manage-tool/tests): tests grouped by domain such as `admin/`, `preview/`, `build-jobs/`, `routes/`, and `upload/`
- [data](/D:/Work/prototype-manage-tool/data): local runtime data, not source code

## High-Value Entry Points

When investigating behavior, start here:

- [middleware.ts](/D:/Work/prototype-manage-tool/middleware.ts)
  Owns locale negotiation and route matching for internationalized pages.
- [i18n/routing.ts](/D:/Work/prototype-manage-tool/i18n/routing.ts)
  Defines supported locales, default locale, and prefix strategy.
- [i18n/request.ts](/D:/Work/prototype-manage-tool/i18n/request.ts)
  Loads locale messages for the current request.
- [app/[locale]/layout.tsx](/D:/Work/prototype-manage-tool/app/[locale]/layout.tsx)
  Validates locale params and binds request locale for nested pages.
- [lib/server/build-job-service.ts](/D:/Work/prototype-manage-tool/lib/server/build-job-service.ts)
  Handles upload ingestion, extraction, dependency install, build, output validation, publishing, and source snapshot creation.
- [lib/server/upload-service.ts](/D:/Work/prototype-manage-tool/lib/server/upload-service.ts)
  Orchestrates product/version mutations, default/offline transitions, deletion, and archive downloadability.
- [lib/server/source-snapshot-service.ts](/D:/Work/prototype-manage-tool/lib/server/source-snapshot-service.ts)
  Owns snapshot persistence and the MCP-facing read/search APIs.
- [lib/server/prototype-mcp-server.ts](/D:/Work/prototype-manage-tool/lib/server/prototype-mcp-server.ts)
  Registers MCP tools.
- [app/api/mcp/route.ts](/D:/Work/prototype-manage-tool/app/api/mcp/route.ts)
  HTTP MCP endpoint.
- [app/api/versions/upload/route.ts](/D:/Work/prototype-manage-tool/app/api/versions/upload/route.ts)
  Upload entry route.
- [app/api/manifest/route.ts](/D:/Work/prototype-manage-tool/app/api/manifest/route.ts)
  Preview manifest endpoint.
- [components/admin-dashboard.tsx](/D:/Work/prototype-manage-tool/components/admin-dashboard.tsx)
  Main admin client surface and orchestration entry.
- [components/admin/hooks/use-product-detail.ts](/D:/Work/prototype-manage-tool/components/admin/hooks/use-product-detail.ts)
  Loads product detail and build jobs, tracks active job selection, and refreshes product state.
- [components/admin/hooks/use-build-job-log.ts](/D:/Work/prototype-manage-tool/components/admin/hooks/use-build-job-log.ts)
  Owns active/history build log fetching and stream subscriptions.
- [components/admin/panels/version-management-panel.tsx](/D:/Work/prototype-manage-tool/components/admin/panels/version-management-panel.tsx)
  Wraps the version table, pagination, and upload trigger in the admin detail page.
- [components/preview/preview-product-list.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-product-list.tsx)
  Main preview client surface.
- [components/preview/preview-product-card.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-product-card.tsx)
  Owns per-product version selection and preview/share actions.
- [components/preview/preview-viewer-dialog.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-viewer-dialog.tsx)
  Owns the fullscreen preview dialog and device viewport switching.

## Data Model

See [prisma/schema.prisma](/D:/Work/prototype-manage-tool/prisma/schema.prisma).

Main models:

- `Product`: stable product identity keyed by `key`
- `ProductVersion`: version metadata, publish status, default flag, storage location, preview entry URL
- `SourceSnapshot`: persisted source tree for a published version
- `UploadRecord`: build-job state, logs, archive path, workspace path, published path

Important status assumptions:

- only `published` versions should appear in preview and MCP source browsing
- a source snapshot is MCP-visible only when its status is `ready`
- default version must always point to a published version when one exists

## Upload and Publish Flow

Source of truth:
- [lib/server/build-job-service.ts](/D:/Work/prototype-manage-tool/lib/server/build-job-service.ts)
- [lib/server/fs-utils.ts](/D:/Work/prototype-manage-tool/lib/server/fs-utils.ts)
- [lib/domain/build-job.ts](/D:/Work/prototype-manage-tool/lib/domain/build-job.ts)

Flow:

1. User uploads a `.zip` archive from admin.
2. Upload is recorded as an `UploadRecord`.
3. Archive is extracted into a build workspace under `data/build-jobs/`.
4. The code locates the effective project root by finding `package.json`.
5. The build job installs dependencies with `pnpm` or `npm`.
6. The build runs via the project's `build` script.
7. `dist/` output is validated and normalized.
8. Published files are copied into `data/prototypes/<product>/<version>/`.
9. A source snapshot is copied into `data/source-snapshots/<product>/<version>/`.
10. `ProductVersion` is marked `published`, and default version may be assigned automatically.

Current upload constraints:

- only `.zip` uploads are accepted
- archive must include `package.json`
- only `pnpm` and `npm` projects are supported
- project must define a `build` script
- publishable output must come from `dist/`
- `dist/index.html` must use relative asset paths
- root-absolute asset references like `/assets/...` are rejected

## Preview Model

Preview is driven by published versions and manifest resolution.

Relevant files:

- [app/preview/page.tsx](/D:/Work/prototype-manage-tool/app/preview/page.tsx)
- [components/preview/preview-product-list.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-product-list.tsx)
- [components/preview/preview-viewer-dialog.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-viewer-dialog.tsx)
- [lib/server/manifest-service.ts](/D:/Work/prototype-manage-tool/lib/server/manifest-service.ts)
- [lib/domain/preview.ts](/D:/Work/prototype-manage-tool/lib/domain/preview.ts)
- [app/prototypes/[...slug]/route.ts](/D:/Work/prototype-manage-tool/app/prototypes/[...slug]/route.ts)

The preview UI does not build prototypes itself. It reads metadata, picks a version, and serves already-published static files.

Locale behavior:

- unprefixed app routes default to `zh`
- English app routes live under `/en/*`
- locale switching is route-based via `next-intl`, not browser-local storage

## MCP Model

Relevant files:

- [app/api/mcp/route.ts](/D:/Work/prototype-manage-tool/app/api/mcp/route.ts)
- [lib/server/prototype-mcp-auth.ts](/D:/Work/prototype-manage-tool/lib/server/prototype-mcp-auth.ts)
- [lib/server/prototype-mcp-server.ts](/D:/Work/prototype-manage-tool/lib/server/prototype-mcp-server.ts)
- [lib/server/source-snapshot-service.ts](/D:/Work/prototype-manage-tool/lib/server/source-snapshot-service.ts)

This repository exposes a remote MCP endpoint over stateless Streamable HTTP.

Contract:

- route: `POST /api/mcp`
- auth: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- if `MCP_AUTH_TOKEN` is empty, endpoint returns `503`
- `GET /api/mcp` and `DELETE /api/mcp` intentionally return `405`

Current MCP tools:

- `list_products`
- `list_versions`
- `resolve_version`
- `get_source_tree`
- `read_source_file`
- `search_source_files`

Current product decisions:

- only published versions are exposed
- only snapshots with `status=ready` are exposed
- there is no page-to-file mapping yet
- source access is filesystem-level, not semantic page-level

## Configuration and Storage

Source of truth:
- [lib/config.ts](/D:/Work/prototype-manage-tool/lib/config.ts)

Important env vars:

- `APP_URL`
- `DATA_DIR`
- `DATABASE_URL`
- `UPLOAD_MAX_MB`
- `MCP_AUTH_TOKEN`

Resolved directories:

- `data/sqlite`
- `data/uploads-temp`
- `data/build-jobs`
- `data/prototypes`
- `data/source-snapshots`

Bootstrap behavior lives in [lib/server/fs-utils.ts](/D:/Work/prototype-manage-tool/lib/server/fs-utils.ts).

## Testing Guidance

Primary commands:

```bash
pnpm test
pnpm typecheck
pnpm build
```

There are targeted tests for the most important backend flows. If you change one of these areas, run the nearest targeted tests first:

- source snapshots and MCP: `tests/source-snapshots/source-snapshot-service.test.ts`, `tests/mcp/mcp-route.test.ts`
- upload/build flow: `tests/upload/upload-service.test.ts`, `tests/build-jobs/build-job-service-source-snapshot.test.ts`
- backfill: `tests/source-snapshots/backfill-source-snapshots.test.ts`

## Release Rules

This repository has an explicit release contract. Do not cut or update releases casually.

Source of truth:

- [package.json](/D:/Work/prototype-manage-tool/package.json)
- [CHANGELOG.md](/D:/Work/prototype-manage-tool/CHANGELOG.md)
- [docker-publish.yml](/D:/Work/prototype-manage-tool/.github/workflows/docker-publish.yml)
- [scripts/prepare-release-notes.mjs](/D:/Work/prototype-manage-tool/scripts/prepare-release-notes.mjs)

Rules:

- Every Git tag intended for release must use the form `vX.Y.Z`.
- The tag version must exactly match `package.json#version`.
- `CHANGELOG.md` must contain a matching `## X.Y.Z` section before the tag is created.
- The changelog is the release-notes source of truth. GitHub Releases should reuse the matching version section from `CHANGELOG.md`.
- `docker-publish.yml` publishes Docker images on `main` and on `v*` tags, but the GitHub Release notes flow only runs on tags.
- On a tag build, the workflow validates the tag against `package.json`, extracts the matching changelog section, and writes it into the GitHub Release.

Practical guidance:

- If you change user-visible behavior, deployment flow, packaging, or operator workflow, update `CHANGELOG.md` in the same branch.
- If you introduce a new release version, update `package.json#version` and add the matching changelog section together.
- Do not add changelog entries for versions that do not have a real git tag in repository history.
- Do not create or move tags from inside routine code changes unless the user explicitly asks for release work.

## Change Guidance for Agents

Prefer these rules when editing:

- Keep business rules in `lib/domain` or `lib/server`, not inside route handlers.
- Keep route handlers thin. Validate input, call service layer, serialize output.
- Preserve path-safety checks. Filesystem writes should remain constrained to configured roots.
- Do not expose unpublished versions through preview or MCP unless the product decision changes explicitly.
- Be careful with default-version behavior. Deleting or offlining a published default should promote another published version when possible.
- Preserve the distinction between published artifacts and source snapshots. They serve different use cases.
- Do not introduce a migration-dependent workflow unless you also update local/dev/docker setup. Current repo behavior is still `db:push`-first.

## Fast Orientation for Common Tasks

If the task is about:

- upload/build failures: start in [lib/server/build-job-service.ts](/D:/Work/prototype-manage-tool/lib/server/build-job-service.ts)
- publish/default/offline/delete behavior: start in [lib/server/upload-service.ts](/D:/Work/prototype-manage-tool/lib/server/upload-service.ts)
- preview selection or broken preview routing: start in [lib/server/manifest-service.ts](/D:/Work/prototype-manage-tool/lib/server/manifest-service.ts) and [app/prototypes/[...slug]/route.ts](/D:/Work/prototype-manage-tool/app/prototypes/[...slug]/route.ts)
- locale-aware page routing or translation issues: start in [middleware.ts](/D:/Work/prototype-manage-tool/middleware.ts), [i18n/routing.ts](/D:/Work/prototype-manage-tool/i18n/routing.ts), [i18n/request.ts](/D:/Work/prototype-manage-tool/i18n/request.ts), and [app/[locale]/layout.tsx](/D:/Work/prototype-manage-tool/app/[locale]/layout.tsx)
- MCP connectivity or tool behavior: start in [app/api/mcp/route.ts](/D:/Work/prototype-manage-tool/app/api/mcp/route.ts) and [lib/server/prototype-mcp-server.ts](/D:/Work/prototype-manage-tool/lib/server/prototype-mcp-server.ts)
- source read/search correctness: start in [lib/server/source-snapshot-service.ts](/D:/Work/prototype-manage-tool/lib/server/source-snapshot-service.ts)
- admin UI bugs: start in [components/admin-dashboard.tsx](/D:/Work/prototype-manage-tool/components/admin-dashboard.tsx), then inspect `components/admin/hooks/*`, `components/admin/panels/*`, and `components/admin/dialogs/*` as needed
- preview UI bugs: start in [components/preview/preview-product-list.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-product-list.tsx) and [components/preview/preview-viewer-dialog.tsx](/D:/Work/prototype-manage-tool/components/preview/preview-viewer-dialog.tsx)

## Known Non-Goals

These are not implemented right now, so do not assume they exist:

- page-to-source-file mapping
- semantic source understanding beyond filesystem tree, file reads, and text search
- exposing unpublished or draft versions over MCP
- migration-driven deployment as the primary workflow
