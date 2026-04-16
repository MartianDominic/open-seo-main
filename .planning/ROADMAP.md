# Roadmap: Unified Platform Infrastructure

## Overview

A brownfield runtime migration: detach open-seo-main from Cloudflare proprietary bindings (D1, KV, Workflows, vite-plugin) and run it as a self-hosted Node.js service alongside the existing AI-Writer platform on a single VPS — fully automated via GitHub Actions CI/CD, backed by shared PostgreSQL and Redis.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: CF Bindings Removal + Schema Migration** - Strip all Cloudflare-specific code; migrate Drizzle schema from SQLite to PostgreSQL; verify Node.js build compiles clean
- [ ] **Phase 2: BullMQ + Redis KV Replacement** - Replace env.KV with ioredis and env.SITE_AUDIT_WORKFLOW with BullMQ; audit queue runs reliably in Node.js
- [ ] **Phase 3: Docker Compose + Infrastructure Assembly** - Package the app in a production Dockerfile; wire all 7 services in docker-compose.vps.yml; verify manual VPS deployment
- [ ] **Phase 4: CI/CD + Deployment Pipeline** - GitHub Actions auto-deploys both platforms on push to main with zero manual intervention

## Phase Details

### Phase 1: CF Bindings Removal + Schema Migration
**Goal**: The open-seo-main codebase compiles and runs as a Node.js server with no Cloudflare runtime dependencies
**Depends on**: Nothing (first phase)
**Requirements**: CF-01, CF-02, CF-03, CF-04, CF-05, CF-06, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):
  1. `grep -r "cloudflare:workers" src/` returns zero matches
  2. `pnpm run build` completes with no TypeScript or Rollup errors and produces `.output/server/index.mjs`
  3. `node .output/server/index.mjs` starts an HTTP server and all routes (auth, server functions, API) return correct responses
  4. `drizzle-kit migrate` applies all PG-dialect migrations to a fresh PostgreSQL instance without errors
  5. `runtime-env.ts` throws a clear startup error when a required environment variable is missing
**Plans**: TBD

### Phase 2: BullMQ + Redis KV Replacement
**Goal**: Site audit jobs are queued and executed via BullMQ on Redis; audit crawl progress is stored in Redis KV — no Cloudflare runtime references remain in the audit path
**Depends on**: Phase 1
**Requirements**: KV-01, KV-02, KV-03, BQ-01, BQ-02, BQ-03, BQ-04, BQ-05, BQ-06, BQ-07
**Success Criteria** (what must be TRUE):
  1. Triggering a site audit enqueues a BullMQ job and the worker picks it up and executes all steps to completion
  2. Audit crawl progress can be read and written via ioredis with correct TTL semantics (30-min expiry, `audit-progress:` prefix)
  3. Redis connection failure at startup prints a clear error and exits the process (not a silent hang)
  4. A failed audit job that exhausts retries appears in the `failed-audits` dead-letter queue
  5. A Lighthouse audit running concurrently does not block the main event loop (sandboxed processor, `lockDuration` >= 120 000 ms)
**Plans**: TBD

### Phase 3: Docker Compose + Infrastructure Assembly
**Goal**: All 7 services (open-seo, open-seo-worker, ai-writer-frontend, ai-writer-backend, postgres, redis, nginx) start from a single `docker compose up` on the VPS and serve both domains over HTTPS
**Depends on**: Phase 2
**Requirements**: DOCKER-01, DOCKER-02, DOCKER-03, DOCKER-04, DOCKER-05, DOCKER-06, DOCKER-07, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. `docker compose -f docker-compose.vps.yml up -d` starts all 7 services with all healthchecks passing
  2. `GET https://app.openseo.so/healthz` returns `{ "status": "ok" }` after a fresh deployment
  3. Both `app.openseo.so` and the AI-Writer domain serve HTTPS responses with valid SSL certificates via Nginx
  4. `open-seo` and `open-seo-worker` services refuse to start until postgres and redis healthchecks pass (`depends_on: service_healthy`)
  5. Structured JSON request logs appear in `docker compose logs open-seo` for each inbound HTTP request
**Plans**: TBD
**UI hint**: yes

### Phase 4: CI/CD + Deployment Pipeline
**Goal**: A push to `main` automatically builds, migrates, and deploys the updated open-seo containers on the VPS — no SSH or manual steps required
**Depends on**: Phase 3
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05
**Success Criteria** (what must be TRUE):
  1. Pushing a commit to `main` triggers the GitHub Actions workflow and the new version is live on the VPS within the workflow run
  2. Database migrations run in a separate `docker compose run --rm` step that completes before the new container receives traffic
  3. The deploy workflow uses pre-generated `KNOWN_HOSTS` and never sets `StrictHostKeyChecking=no`
  4. SSH access to the VPS uses a dedicated `deploy` user (not root) with an ed25519 key stored as a GitHub Actions secret
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CF Bindings Removal + Schema Migration | 0/TBD | Not started | - |
| 2. BullMQ + Redis KV Replacement | 0/TBD | Not started | - |
| 3. Docker Compose + Infrastructure Assembly | 0/TBD | Not started | - |
| 4. CI/CD + Deployment Pipeline | 0/TBD | Not started | - |
