# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Both platforms run reliably on a single VPS, deploy automatically on every push, and share a PostgreSQL instance — zero manual intervention required.
**Current focus:** Phase 1 — CF Bindings Removal + Schema Migration

## Current Position

Phase: 1 of 4 (CF Bindings Removal + Schema Migration)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-17 — Roadmap created; phases and success criteria defined

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-init: Keep R2 for Lighthouse payloads (HTTP API works from Node.js)
- Pre-init: BullMQ over Inngest/Trigger.dev (self-hosted, Redis already required)
- Pre-init: Redis eviction policy `noeviction` (BullMQ requirement overrides volatile-lru)
- Pre-init: Worker runs as a separate Docker service (Lighthouse is CPU-heavy; sandboxed processor prevents event-loop blocking)
- Pre-init: Delete and regenerate drizzle/ migrations (do not migrate SQLite journal to PG)

### Pending Todos

None yet.

### Blockers/Concerns

- Verify exact `createServerEntry` import signature in `@tanstack/react-start` v1.167.17 before writing Phase 1 server entry code
- Confirm VPS postgres volume state before Phase 3: if `postgres_data` already exists, `open_seo` database must be created manually (not via init script)
- Confirm available VPS RAM before setting BullMQ `concurrency` (each Chrome instance is 200-400 MB)

## Session Continuity

Last session: 2026-04-17
Stopped at: Roadmap created; ready to plan Phase 1
Resume file: None
