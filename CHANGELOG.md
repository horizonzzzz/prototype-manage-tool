# Changelog

All notable release changes for `Prototype Manage Tool` are tracked here. GitHub Release pages should reuse the matching version section from this file.

## Unreleased

## 2.0.0

### Breaking Changes

- Switched the platform to Auth.js email/password authentication with account-owned isolation for admin, preview, product, version, build-job, and MCP data.
- Moved locale-aware application routing to `next-intl`, with Chinese served on unprefixed routes and English served under `/en/*`.
- Replaced the legacy MCP mock-data flow with source-index-backed tools and tighter snapshot path isolation, so MCP clients must handle source-index lifecycle states.

### Features

- Added per-user MCP API keys with product-scoped authorization, in-app setup guidance, and richer MCP tools for codebase summary, contextual search, component context, type definitions, and index status.
- Added persisted semantic source indexing for published snapshots, including restart-safe background indexing and improved source understanding for MCP consumers.
- Consolidated account settings management and rebuilt the admin and preview workspaces around prototype-aligned list/detail flows and updated UI fidelity.

### Fixes

- Fixed Docker-deployed preview pages so newly published products appear in `/preview` without rebuilding the image, while preview/share actions now resolve against the published entry URLs.
- Fixed prototype upload and publish handling across Windows and production validation, including yauzl buffer fallback, relative asset normalization, and more stable build-log behavior.
- Fixed auth configuration, preview ownership scoping, public published prototype access, MCP snapshot boundaries, lazy source-index semantics, and semantic source-index accuracy.

### Operations

- Upgraded the stack to Next.js 16, Prisma 7, ts-morph 28, and refreshed related tooling such as xterm packages and Vitest coverage workflows.
- Hardened Docker deploy and upgrade behavior and normalized SQLite path resolution across Prisma CLI and runtime access.

### Developer Experience

- Simplified repository documentation and tightened agent guidance to match the current runtime, release, and source-index workflows.

## 1.4.0

### Features

- Added published source snapshots and remote MCP access at `POST /api/mcp` so agents can list products, resolve versions, browse source trees, read files, and search source text without downloading prototype archives first. (`4626a12`)
- Rebuilt the workspace shell to match the new prototype-style admin experience with sidebar navigation and shared top-bar controls.
- Corrected the UI migration to restore prototype-matched visual styling instead of only reusing the prototype layout structure.
- Added placeholder `login`, `register`, `users`, and `settings` routes to reserve integration points for future auth and account-management capabilities.
- Added local theme and language preferences in the workspace shell, including `light` / `dark` / `system` theme switching, without changing existing auth flow or locale routing contracts.
- Restyled admin product/version management and preview pages around the approved high-fidelity prototype, including card-based preview center and paginated admin lists.

### Operations

- Added changelog-driven GitHub Release notes generation so release tags can publish Docker images and reuse the matching `CHANGELOG.md` section as release notes. (`aadfc2f`)

### Developer Experience

- Added agent-focused repository guidance with `AGENTS.md`, `CLAUDE.md`, and streamlined MCP setup documentation. (`c37f2c9`, `b1df9e3`)
- Ignored local Prisma migration output because this repository still uses a `db:push`-first schema workflow instead of checked-in migration history. (`17fb2ae`)

## 1.3.1

### Features

- Added source archive downloads for admin-managed versions so operators can retrieve the original uploaded package for a published build. (`902afae`)

### Fixes

- Fixed archive download handling for Unicode filenames so non-ASCII upload names can be downloaded correctly. (`5df6f50`)
- Refined version list layout and timestamp presentation in the admin workspace. (`38fc863`)

## 1.3.0

### Features

- Refreshed the admin workspace UI with a Shadcn and Tailwind migration, expanded UI polish, and live build-log streaming for running jobs. (`8c098d4`, `af65624`, `c7805ef`)

### Fixes

- Fixed admin card padding and related layout regressions introduced during the UI migration. (`de0663f`)

## 1.2.2

### Fixes

- Stabilized the admin product list layout so product cards and related metadata render more consistently. (`0ffb6bc`)

## 1.2.1

### Fixes

- Restored Prisma schema availability during Docker image builds and installs so containerized deployments can start reliably. (`553e1c7`)
- Fixed preview-link copy behavior, preview version overflow handling, and related typecheck regressions. (`47604a2`, `cd8beba`)

## 1.2.0

### Features

- Added product deletion and admin navigation fixes so product cleanup and admin workspace movement are more reliable. (`7eb30c0`)

### Operations

- Added multi-architecture Docker image publishing for release builds. (`28c6b50`)
- Ignored local worktree directories in the repository to reduce accidental workspace noise. (`561bfd6`)

## 1.1.1

### Fixes

- Hardened build job behavior and refreshed supporting project documentation. (`4107c9b`)

## 1.1.0

### Features

- Added preview navigation improvements and fixed core admin dashboard flows. (`64e8253`)

## 0.1.0

### Features

- Shipped the first working release of the prototype publishing platform with the initial preview workspace, admin console, and metadata model. (`a9bfa87`)
- Added single-container Docker deployment and switched deployment flow to Docker Hub images. (`5ad6983`, `4450249`)
- Added build job normalization so uploaded prototype archives can be processed into publishable static output more reliably. (`00e95bb`)
