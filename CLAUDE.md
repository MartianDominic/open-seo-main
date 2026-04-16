<!-- GSD:project-start source:PROJECT.md -->
## Project

**Unified Platform Infrastructure**

A self-hosted infrastructure migration that moves open-seo-main from Cloudflare Workers (D1/KV/Workflows) to a VPS-deployed Node.js server backed by PostgreSQL and Redis. Combined with a shared Docker Compose setup, both open-seo-main and AI-Writer (an existing FastAPI + React platform) run on the same VPS under a unified Nginx reverse proxy, with GitHub Actions CI/CD auto-deploying both on push.

**Core Value:** Both platforms run reliably on a single VPS, deploy automatically on every push, and share a PostgreSQL instance — zero manual intervention required.

### Constraints

- **Tech Stack**: open-seo-main must stay on TanStack Start (no framework swap) — just change runtime target from CF Workers to Node.js
- **Drizzle**: must upgrade from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core`; all migrations must be regenerated
- **BullMQ**: requires Redis 6+; job steps must replicate CF Workflows' step-level retry semantics
- **Node.js version**: 22 (matches existing Dockerfile.selfhost)
- **No breaking UI changes**: migration is infrastructure-only; zero user-visible changes
- **Port allocation**: open-seo (3001), ai-writer-frontend (3000, internal), ai-writer-backend (8000, internal), postgres (5432, internal), redis (6379, internal)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Migration Package Changes
### Add (production deps)
| Package | Version | Replaces | Purpose |
|---------|---------|---------|---------|
| `nitro` | `3.0.x-beta` | `@cloudflare/vite-plugin` | Nitro v3 vite plugin (Node.js build) |
| `@tanstack/nitro-v2-vite-plugin` | `1.154.9` | `@cloudflare/vite-plugin` | **Recommended stable alternative** — wraps nitropack v2 |
| `pg` | `8.20.0` | `@libsql/client` / D1 binding | PostgreSQL driver (node-postgres) |
| `drizzle-orm` | `^0.44.4` (already installed) | — | Already installed; only dialect changes |
| `bullmq` | `5.74.1` | `cloudflare:workers` Workflows | Job queue, replaces `WorkflowEntrypoint` |
| `ioredis` | `5.10.1` | `env.KV` | Redis client for KV replacement |
### Add (dev deps)
| Package | Purpose |
|---------|---------|
| `@types/pg` | TypeScript types for node-postgres |
### Remove
| Package | Reason |
|---------|--------|
| `@cloudflare/vite-plugin` | CF-specific; replaced by nitro plugin |
| `@cloudflare/workers-types` | No longer targeting CF runtime |
| `@libsql/client` | Was D1 local dev driver; PostgreSQL replaces this |
| `wrangler` | No longer deploying to CF Workers |
## 1. TanStack Start: Node.js Adapter
### The key finding
### Two plugin options (both work)
### vite.config.ts changes
### src/server.ts — what changes
### Build output and run command
## 2. Drizzle ORM: SQLite → PostgreSQL Migration
### Package changes
### db/index.ts
### Schema column-type mapping (exhaustive)
| SQLite | PostgreSQL | Notes |
|--------|-----------|-------|
| `sqliteTable(...)` | `pgTable(...)` | Direct rename |
| `text("col")` | `text("col")` | Identical |
| `integer("col")` | `integer("col")` | Identical |
| `real("col")` | `real("col")` | Identical (4-byte float) |
| `integer("col", { mode: "boolean" })` | `boolean("col")` | PG has native boolean |
| `integer("col", { mode: "timestamp_ms" })` | `timestamp("col", { mode: "date" })` | See timestamp section |
| `integer("col").primaryKey({ autoIncrement: true })` | `integer("col").primaryKey().generatedAlwaysAsIdentity()` | PG SERIAL alternative |
| `text("col", { enum: [...] })` | `text("col")` + app-level enum OR `pgEnum(...)` | See enum section |
### Timestamp columns — critical difference
### Enum columns
### drizzle.config.ts replacement
### Regenerating migrations
# 1. Delete all old SQLite migrations
# 2. Generate fresh PostgreSQL migrations
# 3. Apply to PostgreSQL
### better-auth adapter change
## 3. BullMQ: Replacing Cloudflare Workflows
### Installation
### Connection pattern
### Queue definition
### Replacing `env.SITE_AUDIT_WORKFLOW.create()` in AuditService.ts
### Replacing `env.SITE_AUDIT_WORKFLOW.get(id).terminate()` in AuditService.ts
### Step-by-step worker: replacing `step.do()`
### Step-level retry semantics vs CF Workflows
| CF Workflows | BullMQ equivalent |
|---|---|
| `step.do("name", fn)` — durably checkpoints | `job.updateData(...)` before advancing step |
| Automatic step retry on failure | Configure `attempts` + `backoff` on the job; worker resumes from last saved step |
| Named steps visible in dashboard | Steps are enum values stored in `job.data.step` |
| `step.do` retries the specific step | On retry, the `if (step === X)` guard re-runs only the incomplete step |
### Worker startup
# Start both server and worker
### Graceful shutdown
## 4. ioredis: Replacing Cloudflare KV
### Installation
### Redis client for KV operations
### progress-kv.ts full rewrite
### CF KV → ioredis API mapping (complete)
| CF KV operation | ioredis equivalent |
|---|---|
| `env.KV.get(key, "text")` | `await redis.get(key)` → `string \| null` |
| `env.KV.get(key, "json")` | `JSON.parse(await redis.get(key) ?? "null")` |
| `env.KV.put(key, value, { expirationTtl: N })` | `await redis.set(key, value, "EX", N)` |
| `env.KV.put(key, value)` (no TTL) | `await redis.set(key, value)` |
| `env.KV.delete(key)` | `await redis.del(key)` |
## 5. Docker: Production Dockerfile
# ---- build stage ----
# Build produces .output/server/index.mjs via Nitro
# ---- runtime stage ----
# Copy only production deps + built output
# Migrations are applied as a separate init container or docker-compose command,
# not inside the app startup — prevents failed migrations from crashing the server.
### docker-compose service entry (for reference)
### Migrations as a separate step
# In docker-compose, run migrations before starting the app service
## 6. `cloudflare:workers` import removal — all locations
| File | CF binding used | Replacement |
|------|----------------|-------------|
| `src/db/index.ts` | `env.DB` | `process.env.DATABASE_URL` via `drizzle(node-postgres)` |
| `src/lib/auth.ts` | `env.BETTER_AUTH_URL`, `env.BETTER_AUTH_SECRET` | `process.env.BETTER_AUTH_URL`, `process.env.BETTER_AUTH_SECRET` |
| `src/server/lib/audit/progress-kv.ts` | `env.KV` | ioredis `redis` singleton |
| `src/server/features/audit/services/AuditService.ts` | `env.SITE_AUDIT_WORKFLOW` | BullMQ `auditQueue` |
| `src/server/workflows/SiteAuditWorkflow.ts` | `WorkflowEntrypoint` from `cloudflare:workers` | Delete file; replace with BullMQ worker |
## Sources
- TanStack Start Hosting docs: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Nitro SSR + TanStack Start example: https://nitro.build/examples/vite-ssr-tss-react
- `node.school` — no .output directory fix: https://node.school/blog/tanstack-start-no-output-directory/
- `@tanstack/nitro-v2-vite-plugin` on npm: https://www.npmjs.com/package/@tanstack/nitro-v2-vite-plugin
- Deploy TanStack Start + PostgreSQL guide: https://dev.to/ameistad/deploy-tanstack-start-postgresql-to-your-own-server-with-haloy-5cda
- Drizzle PG column types: https://orm.drizzle.team/docs/column-types/pg
- Drizzle PG get-started: https://orm.drizzle.team/docs/get-started/postgresql-new
- Drizzle Kit generate: https://orm.drizzle.team/docs/drizzle-kit-generate
- BullMQ Process Step Jobs: https://docs.bullmq.io/patterns/process-step-jobs
- BullMQ Connections: https://docs.bullmq.io/guide/connections
- BullMQ Going to production: https://docs.bullmq.io/guide/going-to-production
- BullMQ Retrying Failing Jobs: https://docs.bullmq.io/guide/retrying-failing-jobs
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
