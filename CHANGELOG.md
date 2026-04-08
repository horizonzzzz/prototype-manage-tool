# Changelog

All notable release changes for `Prototype Manage Tool` are tracked here. GitHub Release pages should reuse the matching version section from this file.

## 1.4.0

### Features

- Added published source snapshots and remote MCP access at `POST /api/mcp` so agents can list products, resolve versions, browse source trees, read files, and search source text without downloading prototype archives first. (`4626a12`)

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
