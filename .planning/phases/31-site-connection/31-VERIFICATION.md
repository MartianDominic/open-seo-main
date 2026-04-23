---
phase: 31-site-connection
verified: 2026-04-22T23:05:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Connection wizard auto-detects platform and presents appropriate credential form"
    status: failed
    reason: "Plan 31-04 (UI) was never executed. No SUMMARY.md exists for 31-04."
    artifacts:
      - path: "src/routes/clients/$clientId/connections/index.tsx"
        issue: "MISSING - Route file does not exist"
      - path: "src/routes/clients/$clientId/connections/new.tsx"
        issue: "MISSING - Route file does not exist"
      - path: "src/components/connections/ConnectionWizard.tsx"
        issue: "MISSING - Component does not exist"
      - path: "src/components/connections/PlatformSelector.tsx"
        issue: "MISSING - Component does not exist"
      - path: "src/components/connections/WordPressCredentialForm.tsx"
        issue: "MISSING - Component does not exist"
      - path: "src/components/connections/ShopifyOAuthButton.tsx"
        issue: "MISSING - Component does not exist"
      - path: "src/components/connections/ConnectionStatus.tsx"
        issue: "MISSING - Component does not exist"
    missing:
      - "Execute plan 31-04 to create connection wizard UI"
      - "Create routes at /clients/:clientId/connections/"
      - "Create ConnectionWizard component with 4-step flow"
      - "Create platform-specific credential forms"
  - truth: "Write permission verified before connection marked active"
    status: partial
    reason: "Backend verifyConnection exists but UI to trigger it does not exist"
    artifacts:
      - path: "src/server/features/connections/services/ConnectionService.ts"
        issue: "Service exists but no UI to invoke it"
    missing:
      - "UI flow that calls verifyConnectionFn after credential submission"
human_verification: []
---

# Phase 31: Site Connection & Platform Detection Verification Report

**Phase Goal:** Unified site connection model with platform auto-detection. Connects to WordPress, Shopify, Wix, Squarespace, Webflow, and custom sites for content management.
**Verified:** 2026-04-22T23:05:00Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | site_connections table exists with encrypted credentials column (AES-256-GCM) | VERIFIED | `src/db/connection-schema.ts` (96 lines) with `encryptedCredentials` text column, AES-256-GCM encryption in `CredentialEncryption.ts` (145 lines), migration at `drizzle/0020_site_connections.sql` |
| 2 | Platform detection correctly identifies WordPress, Shopify, Wix, Squarespace, Webflow | VERIFIED | `PlatformDetector.ts` (315 lines) with DETECTION_PROBES for all platforms, 21 tests passing |
| 3 | WordPress adapter connects via REST API with App Password auth | VERIFIED | `WordPressAdapter.ts` (214 lines) implementing PlatformAdapter with Basic Auth, 11 tests passing |
| 4 | Shopify adapter connects via GraphQL with OAuth token | VERIFIED | `ShopifyAdapter.ts` (247 lines) using Admin GraphQL API with X-Shopify-Access-Token, 14 tests passing |
| 5 | Connection wizard auto-detects platform and presents appropriate credential form | FAILED | Plan 31-04 (UI) never executed. No routes or components exist. |
| 6 | Write permission verified before connection marked active | PARTIAL | `ConnectionService.verifyConnection()` exists but no UI triggers it |

**Score:** 4/6 truths verified (plans 31-01, 31-02, 31-03 complete; plan 31-04 missing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/connection-schema.ts` | site_connections table definition | VERIFIED | 96 lines, pgTable with encrypted credentials, FK to clients, indexes |
| `src/server/features/connections/services/CredentialEncryption.ts` | AES-256-GCM encrypt/decrypt | VERIFIED | 145 lines, IV+TAG+CIPHERTEXT packing, validates 32-byte key |
| `src/server/features/connections/types.ts` | Platform and connection types | VERIFIED | 53 lines, exports PlatformType, ConnectionStatus, DetectionResult |
| `src/server/features/connections/services/PlatformDetector.ts` | Multi-probe platform detection | VERIFIED | 315 lines, weighted scoring, cheerio parsing |
| `src/server/features/connections/adapters/WordPressAdapter.ts` | WordPress REST API adapter | VERIFIED | 214 lines, Basic Auth, getPost/updatePost |
| `src/server/features/connections/adapters/ShopifyAdapter.ts` | Shopify GraphQL adapter | VERIFIED | 247 lines, X-Shopify-Access-Token, getProduct/updateProductSeo |
| `src/server/features/connections/services/ConnectionService.ts` | Connection CRUD with encryption | VERIFIED | 325 lines, encrypts credentials, stripCredentials, adapter factory |
| `src/serverFunctions/connections.ts` | Server functions for connection CRUD | VERIFIED | 204 lines, detectPlatformFn, createConnectionFn, verifyConnectionFn |
| `src/routes/clients/$clientId/connections/index.tsx` | Connections list page | MISSING | Directory does not exist |
| `src/routes/clients/$clientId/connections/new.tsx` | Connection wizard page | MISSING | Directory does not exist |
| `src/components/connections/ConnectionWizard.tsx` | Multi-step connection flow | MISSING | Directory does not exist |
| `src/components/connections/PlatformSelector.tsx` | Platform detection UI | MISSING | Directory does not exist |
| `src/components/connections/WordPressCredentialForm.tsx` | WordPress credential form | MISSING | Directory does not exist |
| `src/components/connections/ShopifyOAuthButton.tsx` | Shopify OAuth button | MISSING | Directory does not exist |
| `src/components/connections/ConnectionStatus.tsx` | Connection status badge | MISSING | Directory does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/db/connection-schema.ts` | `src/db/client-schema.ts` | foreign key clientId | WIRED | Line 50: `.references(() => clients.id, { onDelete: "cascade" })` |
| `CredentialEncryption.ts` | `process.env.SITE_ENCRYPTION_KEY` | env var read | WIRED | Line 30-31: reads from process.env, validates format |
| `src/db/schema.ts` | `connection-schema.ts` | export | WIRED | Line 19: `export * from "./connection-schema"` |
| `ConnectionService.ts` | `CredentialEncryption.ts` | encrypt before storage | WIRED | Line 28 import, Line 100 calls `encryptCredential()` |
| `PlatformDetector.ts` | `cheerio` | HTML parsing | WIRED | Line 12: `import * as cheerio from "cheerio"` |
| `PlatformDetector.ts` | `types.ts` | type imports | WIRED | Line 13: `import type { PlatformType, DetectionResult, DetectionSignal }` |
| `WordPressAdapter.ts` | `BaseAdapter.ts` | implements PlatformAdapter | WIRED | Line 79: `implements PlatformAdapter` |
| `serverFunctions/connections.ts` | `ConnectionService.ts` | service call | WIRED | Line 16: `connectionService` import, used throughout |
| `ConnectionWizard.tsx` | `serverFunctions/connections.ts` | server function calls | NOT_WIRED | ConnectionWizard.tsx does not exist |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ConnectionService.ts` | credentials | encryptCredential() input | Yes - real JSON credentials | FLOWING |
| `PlatformDetector.ts` | html | fetch() from external site | Yes - real HTTP response | FLOWING |
| Connection UI | connections list | getConnectionsFn | N/A | DISCONNECTED - UI does not exist |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests pass | `pnpm test src/server/features/connections/` | 70 passed (70) | PASS |
| TypeScript compiles | `pnpm tsc --noEmit \| grep connections` | No errors | PASS |
| Encryption service exports | `grep encryptCredential src/server/features/connections/index.ts` | Found at line 15 | PASS |
| PlatformDetector exports | `grep detectPlatform src/server/features/connections/index.ts` | Found at line 11 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONN-01 | 31-01 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |
| CONN-02 | 31-01 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |
| CONN-03 | 31-01 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |
| CONN-04 | 31-02, 31-03 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |
| CONN-05 | 31-03, 31-04 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |
| CONN-06 | 31-04 | Not defined in REQUIREMENTS.md | N/A | Requirements file does not contain CONN-* requirements |

**Note:** The requirement IDs SC-01, SC-02, SC-04, SC-06 mentioned in the verification request do not exist in REQUIREMENTS.md. The CONN-* requirements referenced in plan frontmatter are also not defined. The REQUIREMENTS.md only contains infrastructure migration requirements (CF-*, DB-*, KV-*, BQ-*, DOCKER-*, OPS-*, CI-*).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found in connections feature files |

### Human Verification Required

None - all verifiable items were checked programmatically. UI verification would be needed once plan 31-04 is executed.

### Gaps Summary

**Plan 31-04 (UI) was never executed.** The 31-04-SUMMARY.md file does not exist, and no route or component files were created.

**Missing UI artifacts (8 files):**
1. `src/routes/clients/$clientId/connections/index.tsx` - Connections list page
2. `src/routes/clients/$clientId/connections/new.tsx` - Connection wizard page
3. `src/components/connections/ConnectionWizard.tsx` - Multi-step wizard
4. `src/components/connections/PlatformSelector.tsx` - Platform detection UI
5. `src/components/connections/WordPressCredentialForm.tsx` - WordPress form
6. `src/components/connections/ShopifyOAuthButton.tsx` - Shopify OAuth
7. `src/components/connections/ConnectionStatus.tsx` - Status badge
8. `src/serverFunctions/connections.test.ts` - Server function tests (optional)

**Backend is complete and tested:**
- 70/70 tests passing
- All services wired correctly
- Schema, encryption, detection, adapters, ConnectionService all verified
- Server functions exist but no UI to call them

**To close gaps:** Execute plan 31-04 to create the connection wizard UI.

---

_Verified: 2026-04-22T23:05:00Z_
_Verifier: Claude (gsd-verifier)_
