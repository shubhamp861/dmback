# DMlinl Project Context

## Latest implementation update — 2026-10-19

### P0 API contract/idempotency follow-up — 2026-10-20

Started P0-007 in the renamed Windows project `node_code`. Added standardized
JSON error behavior: generated local request IDs, `code`/`message` with optional
`fields`/`requestId`, stable JSON/content-type/body-limit errors, raw webhook
preservation, and Fastify 5 `logController` request logging.

Added durable optional `Idempotency-Key` support for authenticated automation
create/status and webhook replay POSTs. Migration `003_idempotency_keys.sql`
stores workspace/user fingerprints and completed response bodies; matching
requests replay, different/in-progress requests conflict, and handler failures
abandon records. Keys are printable ASCII 1–128 characters. Do not put secrets
in response bodies. Retention cleanup is pending.

Targeted P0-007 tests passed: 25. Full suite reached 306 passed and one stale
migration-discovery assertion failed because migration 003 was newly present;
the assertion was updated afterward and the full suite must be rerun. Remaining
P0-007 work: pagination, OpenAPI, retention cleanup, broader request/CORS
coverage, and CI/live migration verification.

### Rate-limit follow-up — 2026-10-20

Added `src/rate-limit.ts` with a separate lazy ioredis connection and an atomic
fixed-window Lua counter. Authenticated routes use independent user/workspace
buckets; authentication endpoints use an IP bucket; signed Instagram delivery
uses a webhook IP bucket. Limited responses return `429 RATE_LIMITED` with
`RateLimit-Limit`, `RateLimit-Remaining`, and `Retry-After`. Redis limiter errors
fail open so webhook persistence remains durable. Configure thresholds with the
`RATE_LIMIT_*` environment variables shown in `.env.example`.

Focused tests passed and the full local suite now passes 309 tests across 24
files. Typecheck, build, and diff checks passed. The automation environment
cannot currently reach the Windows disposable PostgreSQL service on
`127.0.0.1:15432`; rerun `npm run test:integration` after starting the Windows
test infrastructure to verify the new limiter against real Redis.

### Audited webhook replay follow-up

Added Owner/Admin + CSRF endpoint `POST /v1/webhook-events/:id/replay` and
migration `backend/migrations/002_webhook_replays.sql`. Apply migrations on
Windows before restarting API/worker. Every accepted replay has a new durable
request UUID and atomic immutable `webhook.replay.requested` audit row with
actor/workspace/event/time and minimal replayId metadata. No payload is exposed.

Whole payload ownership is checked: unknown, foreign, mixed-workspace and
unsupported events return a uniform 404. Processing rechecks ownership, scopes
automation reads, and guards trigger writes within their transaction. Separate
replay job IDs avoid retained original jobs swallowing retries. Existing trigger
idempotency is never reset; completed replay redeliveries are no-ops. Redis
dispatch failure remains recoverable through the replay outbox. Replay applies
current live rules, not historical snapshots, and never resends a message.

Current checks passed: 293 unit/HTTP-double tests across 20 files, typecheck,
build, tracked diff whitespace check. Added six replay integration scenarios
(14 real-service cases total); setup remains blocked here by ECONNREFUSED on
test PostgreSQL port 15432 by default. Do not claim live migration/replay/CI passed.
An old migration-discovery assertion was updated for migration 002. Fastify
injection cold start now initializes in a bounded setup hook; actual assertion
timeouts remain unchanged. No dependency installations or Linux services used.

Remaining replay work: live Windows integration verification, time-range/bulk
operations, rate limits, audit/status UI/API and future retention handling.
See `backend/README.md` and `share/API-AUTH-MAPPING.md` for the endpoint contract.

### Configuration/security follow-up

User reported the Windows tests looked good and authorized this next step; exact
Windows integration output was not captured. Do not present it as an independent
automation/CI receipt. Windows native dependencies must not be reinstalled or
modified from the automation environment (earlier cross-platform changes caused
missing Rollup binaries and Windows esbuild file-lock problems).

Added strict staging/production config validation, canonical encryption-key
validation shared with crypto, `.env.production.example`, safe runtime log/error
serializers, stable outbox failure codes, sanitized BullMQ processor errors, and
Secure staging cookies. Development/test defaults remain usable. Current checks
passed: typecheck/build and 254 unit/HTTP-double tests across 17 files using
existing isolated tooling. No dependency or Linux service installation was run.
Security changes still need a Windows integration rerun. KMS/envelope encryption,
rotation/migration, audit, deployment TLS/secrets integration and production
review remain open. Do not rotate existing local keys without a migration plan.

### Integration infrastructure follow-up

Added `backend/docker-compose.test.yml`, `vitest.integration.config.ts`, and
`tests/integration/` with a dedicated `npm run test:integration` command. The
test targets never fall back to developer connection settings: dedicated test
database name ending `_test`, Redis DB `/15`, random schema/queue prefix, and
separate local ports 15432/56379 by default. Worker processing was extracted to
`backend/src/processing.ts` and is used by both the worker and tests.
CI now has PostgreSQL/Redis service containers for integration tests.

Latest checks: typecheck/build and 206 unit/HTTP-double tests passed. Integration
setup previously failed with `ECONNREFUSED 127.0.0.1:55432`; Docker/test services are not
available to the automation runtime. No live integration/CI pass is claimed.
Windows next step: `npm run test:infra:up`, `npm run test:integration`, then
`npm run test:infra:down` from the backend directory. No Linux services installed.

This section supersedes older statements below about health checks and role
enforcement. Windows remains the target development environment. No Linux
database or Redis services were installed or started for this update.

- `/health` and `/live` are dependency-independent liveness endpoints returning
  `{"status":"ok"}`. Use `/ready` for PostgreSQL and Redis readiness (200/503).
- Added bounded readiness checks, finite database/Redis producer timeouts,
  idempotent API/worker shutdown, and non-overlapping, drainable outbox polling.
- Central role policies now protect existing workspace resource routes:
  Owner/Admin connect Instagram; Owner/Admin/Editor mutate automations;
  Viewer reads only. Unknown roles are denied; session/CSRF remain required.
- Checks passed: `npm run typecheck`, `npm run build`, and 193 tests across
  12 files. Tests ran in the automation container with Linux-only build-tool
  binaries from `/tmp/dmlink-runtime-test` and `--maxWorkers=2`; this is not
  evidence that live Windows Docker outage/restart behavior passed.
- Still pending: real PostgreSQL/Redis integration tests and CI services,
  concurrent webhook/recovery and signal tests, authorized replay, audit and
  membership management, production secret hardening/KMS, and API controls.
  No claim is made that all P0 work is complete.

Relevant code: `backend/src/health.ts`, `runtime.ts`, `authorization.ts`,
`app.ts`, `server.ts`, `worker.ts`, `queue.ts`, `db.ts`, and `routes.ts`.

> **Purpose:** This is the single orientation document for future AI sessions.
> Read it before changing anything in `/home/shubham/dmlinl`.
>
> **Last reviewed:** 2026-10-17
> **Current product state:** Backend foundation is implemented; frontend and most
> production Instagram automation capabilities are not implemented yet.

## How to use this document in a new session

Start a new session by pointing the AI to:

```text
Read /home/shubham/dmlinl/PROJECT_CONTEXT.md first. Treat it as the project
orientation document, then inspect the exact source files and git status before
editing. Do not read or expose .env secrets.
```

This file is a map and a current-state summary. The source code is authoritative
for implemented behavior. The detailed backlog is in
`backend/devResource/BACKEND-PENDING-TASKS.md`.

## 1. Product goal

DMlinl is intended to become an Instagram comment-to-DM automation service.
Users should eventually be able to:

1. Create an account and workspace.
2. Connect a professional Instagram account through Meta OAuth.
3. Configure automations that match Instagram comments by keyword/rules.
4. Send a public comment reply and/or private Instagram DM.
5. Build multi-step flows, follow-ups, and lead/contact actions.
6. Inspect events, analytics, usage, billing, and operational failures.

The current code implements the first backend foundation: authentication,
workspace-scoped automation records, webhook verification and persistence,
keyword matching, a durable webhook outbox, and a Redis/BullMQ matching worker.
It currently records a matching result; it does **not** send real replies or DMs.

## 2. Workspace and repository boundaries

The project is located at:

```text
/home/shubham/dmlinl
```

Directory map:

```text
dmlinl/
├── PROJECT_CONTEXT.md          # This document; read first in future sessions
├── share/                      # Documents shared with frontend/other teams
│   └── API-AUTH-MAPPING.md     # Current frontend API and auth contract
├── backend/                    # Active backend application and separate Git repo
│   ├── src/                    # TypeScript application code
│   ├── scripts/                # Migrations, seed, smoke, and onboarding scripts
│   ├── migrations/             # PostgreSQL SQL migrations
│   ├── tests/                  # Vitest tests
│   ├── devResource/            # Specification, backlog, and Meta contract notes
│   ├── package.json            # Commands and dependencies
│   ├── package-lock.json       # Locked npm dependency graph
│   ├── docker-compose.yml      # Local PostgreSQL and Redis containers
│   ├── .env.example            # Safe configuration template; no real secrets
│   ├── README.md               # Backend usage and API examples
│   └── INSTALL_PREREQUISITES.md# Manual/native setup guide
└── frontend/                   # Not implemented yet; currently only devResource/
```

### Git repositories

There are two nested Git boundaries. Always check the correct one before work:

- `/home/shubham/dmlinl/.git`
  - Branch: `master`
  - No commits yet and no remote configured at the last review.
  - The backend directory currently appears as an untracked directory here.
- `/home/shubham/dmlinl/backend/.git`
  - Branch: `main`, tracking `origin/main`.
  - Latest known commit: `b098dd7 first commit`.
  - At the last review, `README.md` was modified and most current backend files
    were untracked relative to this nested repository.

Do not commit, push, reset, or reorganize either repository unless the user asks.
Preserve unrelated working-tree changes. Use the backend repository as the
application root for backend development commands.

### Frontend status

`/home/shubham/dmlinl/frontend` currently has no package manifest, source code,
lockfile, framework, or build configuration. Do not assume a frontend stack has
already been selected. The backend API is the only implemented application.

## 3. Current implementation status

### Implemented foundation

- Fastify API with strict TypeScript configuration.
- PostgreSQL persistence through handwritten SQL and `pg`; no ORM.
- Redis/BullMQ queue boundary for asynchronous comment matching.
- PostgreSQL migration runner with ordered discovery, SHA-256 checksums,
  advisory locking, transactions, and migration status reporting.
- Repeatable local seed data for a development workspace, account, user, and
  live `guide` automation.
- Instagram webhook GET challenge verification.
- Raw-body HMAC-SHA256 signature verification for Instagram webhook POSTs.
- Webhook payload validation, SHA-256 duplicate detection, transactional outbox,
  immediate queue dispatch, and worker retry polling.
- Comment extraction, top-level-comment filtering, keyword matching, exclusions,
  and idempotent trigger-event recording.
- Argon2id password hashing, database-backed opaque sessions, cookie auth,
  CSRF protection, signup/login/logout/me, and password reset persistence.
- Basic workspace-scoped automation reads and mutations.
- Provisional Instagram OAuth start/callback and connected-account listing.
- Local AES-256-GCM token encryption for development only.
- Native Ubuntu/Debian/WSL onboarding installer at
  `backend/scripts/bootstrap.sh`.
- Windows PowerShell onboarding installer at
  `backend/scripts/bootstrap-windows.ps1`, using winget and Docker Desktop.
- One-command local startup script at `backend/scripts/start-dev.sh` for native
  or Docker PostgreSQL/Redis, migrations, seed data, and the API.
- Unit tests, typecheck, production TypeScript build, and GitHub Actions CI.

### Important incomplete behavior

- A `queued` trigger event means only that matching succeeded. No public reply or
  private Instagram DM is sent yet.
- OAuth values, scopes, endpoints, profile fields, webhook fields, and messaging
  behavior remain provisional until confirmed with current Meta documentation and
  a real staging professional Instagram account.
- Local AES-GCM token encryption must be replaced by production KMS-backed
  envelope encryption, with rotation and audit support.
- Token refresh, reconnect/disconnect, Meta deauthorization, account webhook
  subscriptions, and account health scheduling are not implemented.
- Role names exist in the schema, but full Owner/Admin/Editor/Viewer policy
  enforcement is not implemented.
- The API lacks full CRUD, pagination, OpenAPI, broad idempotency, rate limits,
  and many product endpoints.
- Password reset email delivery is not implemented.
- Live PostgreSQL/Redis/API/worker integration testing is still incomplete.
- The frontend does not exist yet.

## 4. Technology and runtime

### Required runtime

- Node.js `>=20`; local development has used Node 22.
- npm with the checked-in `package-lock.json`.
- PostgreSQL 15+ for development; Docker Compose uses PostgreSQL 16.
- Redis 7+; Docker Compose uses Redis 7.
- Python 3, pip, and venv are installed by the onboarding script for machine
  prerequisites/supporting tooling, although the backend itself is TypeScript.

### Main dependencies

From `backend/package.json`:

- Fastify 5: HTTP server.
- Zod: request and configuration validation.
- `pg`: PostgreSQL client.
- BullMQ and ioredis: Redis-backed jobs and worker queue.
- Argon2: password hashing.
- `@fastify/cookie`, CORS, Helmet, and `fastify-raw-body`: HTTP security and
  webhook handling.
- dotenv: local environment loading.
- TypeScript, tsx, and Vitest: development, build, and tests.

### Two runtime processes

1. **API process** — `src/server.ts`
   - Loads config, builds Fastify, registers routes, listens on `HOST`/`PORT`.
2. **Worker process** — `src/worker.ts`
   - Consumes the `match-comment` BullMQ queue.
   - Matches persisted webhook comments against live automations.
   - Polls the webhook outbox for dispatch recovery.

PostgreSQL is the source of truth. Redis is used for asynchronous queueing and
BullMQ job coordination. Docker Compose supplies only PostgreSQL and Redis; it
does not run the API or worker.

## 5. Backend file guide

All paths below are relative to `/home/shubham/dmlinl/backend` unless noted.

### Application entry and wiring

- `src/server.ts`
  - Production/dev API entry point.
  - Calls `loadConfig()`, `buildApp()`, and `app.listen()`.
- `src/app.ts`
  - Creates Fastify and wires `Database`, `BullMqEventQueue`, `AuthService`, and
    `InstagramOAuthService`.
  - Registers cookies, Helmet, CORS, raw-body capture, request IDs, body limit,
    global error handling, and application shutdown cleanup.
- `src/config.ts`
  - Zod-validated environment configuration.
  - Handles runtime, database, Redis, Meta, token encryption, CORS, and logging
    settings. Do not put actual values in this context file.
- `src/routes.ts`
  - All currently implemented HTTP routes and auth/CSRF helpers.
- `src/db.ts`
  - PostgreSQL pool and handwritten queries for auth, OAuth state, accounts,
    automations, webhook events, outbox records, and trigger events.
  - The webhook outbox insert must use separate PostgreSQL parameters for the
    UUID `webhook_event_id` and text `job_id`; this was fixed after the live smoke
    test exposed PostgreSQL error `42P08` from reusing one parameter in both types.
- `src/queue.ts`
  - BullMQ queue boundary, queue name, job payload, retry/backoff, and close logic.
- `src/auth.ts`
  - Password hashing, session creation/authentication/logout, reset-token flow,
    token hashing, and auth context.

### Domain logic

- `src/domain/automation.ts`
  - Automation input schema, schedule/rule validation, match result types, and
    reason codes.
- `src/domain/keyword-matcher.ts`
  - Contains, exact, starts-with, and regex matching; case/whitespace/punctuation
    normalization; exclusions; and match result details.

### Instagram integration

- `src/instagram/webhook.ts`
  - Zod payload parsing and extraction of supported comment-change events.
- `src/instagram/signature.ts`
  - HMAC-SHA256 verification over the raw request body, constant-time comparison,
    and SHA-256 payload hashing.
- `src/instagram/oauth.ts`
  - Authorization URL, session-bound one-time state, code/token exchanges,
    profile lookup, professional-account validation, account upsert, and stable
    OAuth errors.
- `src/instagram/token-crypto.ts`
  - Development AES-256-GCM encrypt/decrypt helpers. Production KMS work remains.

### Worker flow

- `src/worker.ts`
  - Reads the persisted webhook payload.
  - Extracts comment changes.
  - Loads live automations for the Instagram account.
  - Skips replies to non-top-level comments.
  - Evaluates exclusions and keyword rules.
  - Inserts one idempotent trigger result per automation.
  - Marks the webhook processed after matching completes.
  - Retries pending/failed/stale outbox dispatch records.

## 6. HTTP API currently available

All route definitions are in `src/routes.ts`. Authenticated routes require the
session cookie. State-changing authenticated automation routes also require the
CSRF cookie value in the `x-csrf-token` header.

### Health and webhooks

| Method | Path | Current behavior |
| --- | --- | --- |
| GET | `/health` | Checks PostgreSQL and returns `ok`/`degraded`; does not check Redis |
| GET | `/v1/webhooks/instagram` | Validates Meta challenge token and returns challenge |
| POST | `/v1/webhooks/instagram` | Verifies raw-body signature, persists event/outbox, attempts queue dispatch |

The webhook POST returns acceptance even when immediate Redis dispatch fails,
because the PostgreSQL outbox remains available for worker retry.

### Authentication

| Method | Path | Current behavior |
| --- | --- | --- |
| POST | `/v1/auth/signup` | Creates user, workspace, owner membership, and session |
| POST | `/v1/auth/login` | Starts an authenticated session |
| POST | `/v1/auth/logout` | Revokes current session and clears cookies |
| GET | `/v1/auth/me` | Returns current user/workspace/role context |
| POST | `/v1/auth/reset/request` | Creates a reset record; email delivery is not implemented |
| POST | `/v1/auth/reset/confirm` | Validates reset token, changes password, revokes sessions |

### Instagram account connection

| Method | Path | Current behavior |
| --- | --- | --- |
| GET | `/v1/auth/instagram/start` | Authenticated session-bound OAuth redirect |
| GET | `/v1/auth/instagram/callback` | Consumes state, exchanges code, loads profile, encrypts token, upserts account |
| GET | `/v1/ig-accounts` | Lists workspace accounts without token material |

### Automations

| Method | Path | Current behavior |
| --- | --- | --- |
| GET | `/v1/automations` | Lists workspace automations |
| POST | `/v1/automations` | Creates a draft for an existing workspace account |
| GET | `/v1/automations/:id` | Gets one workspace-scoped automation |
| GET | `/v1/automations/:id/events` | Lists trigger events for an automation |
| POST | `/v1/automations/:id/publish` | Sets status to `live` (full publish validation pending) |
| POST | `/v1/automations/:id/pause` | Sets status to `paused` |
| POST | `/v1/automations/:id/resume` | Sets status to `live` |

Not currently implemented: PATCH, DELETE, duplicate, test-send, activity
filters, retry, cursor pagination, full publish validation, or message sending.

## 7. Database and migration model

### Database migration

- SQL schema: `migrations/001_initial.sql`.
- Migration runner: `scripts/migrate.ts`.
- Migration helpers/status: `scripts/migration-utils.ts` and
  `scripts/migration-status.ts`.
- Seed script: `scripts/seed.ts`.
- The migration runner discovers numeric SQL filenames, sorts them, hashes their
  contents, uses a PostgreSQL advisory lock, creates/reads `schema_migrations`,
  runs each new migration in its own transaction, and rejects changed or missing
  applied migration files.
- Only `001_initial.sql` currently exists.

### Current tables

The initial migration defines these groups of tables:

- **Identity/auth:** `workspaces`, `users`, `memberships`, `user_sessions`,
  `password_reset_tokens`, `instagram_oauth_states`.
- **Instagram/content:** `ig_accounts`, `media`, `contacts`.
- **Automation:** `flows`, `automations`.
- **Events:** `webhook_events`, `webhook_event_outbox`, `trigger_events`,
  `trigger_event_idempotency`.
- **Messaging/operations:** `messages`, `usage_counters`, `audit_log`.

Important behavior:

- `webhook_events` are deduplicated by SHA-256 payload hash.
- `webhook_event_outbox` is inserted in the same transaction as the webhook event.
- `trigger_events` are range-partitioned by `created_at` with a default partition.
- `trigger_event_idempotency` is separate from the partitioned table and prevents
  duplicate matching by account/comment/automation key.
- Monthly partitions, retention jobs, and raw webhook partitioning are pending.
- Several tables are foundations only; media, flows, contacts, messages, usage,
  and audit behavior are not fully exposed through APIs yet.

### Queue and recovery flow

The queue name is `match-comment` and the job payload contains a webhook event ID.
BullMQ uses the webhook event ID as the job ID, with bounded retries and
exponential backoff.

The normal flow is:

1. Meta sends `POST /v1/webhooks/instagram`.
2. API verifies the raw body signature and parses the payload.
3. API transactionally stores the webhook and its outbox record.
4. API attempts immediate BullMQ dispatch.
5. If Redis dispatch fails, the API records the failure and still acknowledges the
   accepted webhook.
6. The worker polls pending, failed, or stale outbox rows and retries dispatch.
7. Worker loads live automations, evaluates each top-level comment, and records a
   trigger event.
8. Database idempotency prevents duplicate matching effects on replay.

The outbox does not yet provide an authorized operator replay endpoint. Public
reply and private-DM send queues are also not implemented.

## 8. Authentication and security model

- Passwords use Argon2id.
- Session cookies contain opaque random tokens; only token hashes are stored.
- Sessions are database-backed and last 30 days by default.
- Session cookie is HTTP-only and SameSite `lax`; production enables `secure`.
- A separate readable CSRF cookie is compared with the `x-csrf-token` header and
  the stored session CSRF hash for state-changing automation requests.
- Signup creates a workspace and owner membership.
- Password reset confirmation changes the password, consumes the reset token, and
  revokes the user's sessions.
- Role values are persisted, but route-level role policy is not complete.
- Workspace scoping is implemented for current automation/account queries, but
  broad cross-workspace authorization tests and membership management are still
  needed.
- Fastify Helmet, CORS, body limits, request IDs, and a global error handler are
  enabled.
- Never log or commit passwords, session tokens, CSRF values, Meta credentials,
  access tokens, reset tokens, or private payloads.

## 9. Instagram OAuth and Meta integration

The current implementation is explicitly provisional. The detailed contract is
in `backend/devResource/META-INTEGRATION-CONTRACT.md`.

Current assumed flow:

1. Authenticated user calls `/v1/auth/instagram/start`.
2. Backend creates a random, one-time state bound to session, user, workspace,
   redirect URI, and a ten-minute expiry.
3. User authorizes through the configured Instagram OAuth URL.
4. Callback validates the same session-bound state and exchanges the code.
5. Backend obtains a long-lived token, loads profile fields, checks professional
   account type, encrypts the token, and upserts the account.

Current configuration is controlled by environment variables such as:

```text
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI
META_API_VERSION
META_GRAPH_BASE_URL
META_OAUTH_BASE_URL
META_INSTAGRAM_SCOPES
META_WEBHOOK_VERIFY_TOKEN
TOKEN_ENCRYPTION_KEY
```

The current defaults and scope names must be checked against current Meta
documentation before staging/production. No real Meta credentials or staging
professional account are present in this repository.

Current local encryption is AES-256-GCM using `TOKEN_ENCRYPTION_KEY`. Production
requires KMS-backed envelope encryption, key versions/rotation, and access audit.

## 10. Important setup files and scripts

### Configuration and infrastructure

- `backend/.env.example` — variable names and placeholder development values.
- `backend/.env` — local ignored configuration; never copy its contents into
  documentation or commits.
- `backend/docker-compose.yml` — PostgreSQL 16 and Redis 7 with persistent
  named volumes and health checks, exposed on ports 5432 and 6379.
- `backend/tsconfig.json` — strict ES2022/NodeNext TypeScript build settings.
- `backend/.github/workflows/ci.yml` — Node 20 CI running `npm ci`, typecheck,
  tests, and build; it does not currently provision PostgreSQL/Redis integration
  services.

### Onboarding and local scripts

- `scripts/bootstrap.sh`
  - Native Ubuntu/Debian/WSL installer.
  - Must be run as a normal user with `sudo`, not as root.
  - Installs Python, build tools, Node 22 via pinned nvm, PostgreSQL, and Redis.
  - Starts services, creates the local database/role, creates `.env` only when
    missing, installs npm dependencies, migrates/seeds, and runs checks.
  - Existing `.env` content is preserved.
  - If an existing local role has a mismatched password, use the explicit
    `RESET_DB_PASSWORD=1` override; it is intentionally not automatic.
- `scripts/start-dev.sh`
  - Starts native services by default, or Docker services with
    `INFRA_MODE=docker`.
  - Checks PostgreSQL and Redis, optionally runs migrations/seed data, then keeps
    the API in the foreground.
  - Does not start the worker; run `npm run dev:worker` separately.
- `scripts/bootstrap-windows.ps1`
  - Windows PowerShell onboarding path.
  - Uses `winget` to install/verify Git, Python, Node.js LTS/npm, and Docker
    Desktop, then starts Docker Compose PostgreSQL/Redis, migrates, seeds, and
    runs project checks.
  - Preserves an existing `.env` and requires Docker Desktop's Linux engine.
- `scripts/migrate.ts` — applies pending migrations.
- `scripts/migration-status.ts` — reports applied/pending/modified/missing state.
- `scripts/migration-utils.ts` — migration discovery, checksum, and status logic.
- `scripts/seed.ts` — repeatable local development records.
- `scripts/send-local-webhook.ts` — signs and sends a local comment webhook.

## 11. Local setup and operating commands

Run backend commands from:

```bash
cd /home/shubham/dmlinl/backend
```

### Recommended native onboarding

On Ubuntu, Debian, or Ubuntu/Debian WSL:

```bash
./scripts/bootstrap.sh
```

The installer uses native services and is intended for a normal user with sudo.
It is not a production deployment tool and does not install Docker.

After onboarding, start native PostgreSQL, Redis, migrations, seed data, and the
API together:

```bash
npm run dev:all
```

Use Docker infrastructure instead with:

```bash
INFRA_MODE=docker npm run dev:all
```

### Manual Docker setup

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run db:migrate:status
npm run db:seed
```

Docker Compose starts PostgreSQL and Redis only. Start the application separately:

```bash
npm run dev
```

In another terminal:

```bash
npm run dev:worker
```

### Development smoke flow

Health endpoint:

```bash
curl --fail-with-body http://localhost:3000/health
```

Signed local webhook:

```bash
npm run webhook:smoke
```

The seed creates a local live `guide` automation and a local Instagram account.
The smoke event should produce a queued trigger event; it does not send a real
Instagram DM.

For authenticated API calls, login first and preserve the session/CSRF cookies as
shown in `backend/README.md`. Automation mutation requests need both the session
cookie and the CSRF header.

### Compiled execution

```bash
npm run build
npm start
```

Worker compiled execution:

```bash
npm run start:worker
```

Do not run both `npm run dev` and `npm start` for the same port at the same time.

## 12. npm commands

All commands are defined in `backend/package.json`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode API server |
| `npm run dev:worker` | Watch-mode matching worker |
| `npm run dev:all` | Start local infrastructure, database setup, and API |
| `npm start` | Run compiled API from `dist` |
| `npm run start:worker` | Run compiled worker from `dist` |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run typecheck` | TypeScript check without emitting |
| `npm run build` | Compile TypeScript to `dist` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:migrate:status` | Show migration status/checksums |
| `npm run db:seed` | Insert repeatable local seed data |
| `npm run webhook:smoke` | Send a signed local webhook |

## 13. Tests and check evidence

### Test locations

- `tests/auth.test.ts` — authentication/session behavior.
- `tests/automation.test.ts` — automation input and matching outcomes.
- `tests/keyword-matcher.test.ts` — keyword modes, normalization, exclusions,
  and regex behavior.
- `tests/migrations.test.ts` — migration discovery/status/checksum behavior.
- `tests/instagram-oauth.test.ts` — OAuth URL/config behavior.
- `tests/signature.test.ts` — Meta signature verification and payload hashing.
- `tests/token-crypto.test.ts` — local token encryption/decryption.

### Latest checks from the current work session

Run from `/home/shubham/dmlinl/backend`:

- `npm ci` — **passed**; npm reported 3 audit vulnerabilities (1 moderate,
  2 critical) that have not been resolved.
- `npm run typecheck` — **passed**.
- `npm test` — **passed**, 7 test files and 29 tests.
- `npm run build` — **passed**.
- `bash -n scripts/bootstrap.sh` — **passed**.
- `./scripts/bootstrap.sh --help` — **passed**.
- `bash -n scripts/start-dev.sh` — **passed**.
- `npm run dev:all -- --help` — **passed**.
- `git diff --check` — **passed** for tracked diffs.
- `.env` required-key check — **passed**; all 16 expected keys were present and
  the file permission was corrected to `600` without printing values.
- Zod configuration validation — **passed**.
- Local token encryption round-trip using the configured key — **passed**.
- PostgreSQL credential check — **passed** for the `instagram` role and
  `instagram_automation` database.
- `npm run db:migrate` — **passed**; applied `001_initial.sql`.
- `npm run db:migrate:status` — **passed**; migration reported `APPLIED`.
- `npm run db:seed` — **passed**; local workspace/account/automation seed created
  or was reused.
- `redis-cli -h 127.0.0.1 -p 6379 ping` — **passed**, returned `PONG`.
- `pg_isready -h 127.0.0.1 -p 5432` — **passed**, PostgreSQL accepted connections.
- Temporary API startup with `npm run dev` and `GET /health` — **passed**;
  returned `{"status":"ok","database":"up"}`.
- Temporary worker startup with `npm run dev:worker` — **passed** startup
  without errors; the process was stopped after the connectivity check.
- End-to-end temporary API/worker/webhook smoke — **passed** after the outbox
  parameter fix; health returned `database: up`, the signed webhook returned
  `200 {"received":true}`, and the worker recorded `queued||guide`.
- Full current API endpoint smoke — **passed** against a live temporary API and
  worker: health, webhook challenge/signature/payload paths, signup/login/logout,
  auth/me, password reset request/invalid confirmation, account listing,
  automation CRUD/status/events paths, CSRF rejection, duplicate webhook
  delivery, and worker read-back were checked. OAuth start correctly returned
  `503 META_CONFIG_MISSING` because real Meta credentials are not configured.
- `npm run dev:all` itself — **not run to completion** in the root sandbox because
  the script intentionally requires a normal user rather than root. Its syntax,
  help, and npm wrapper were checked.
- `./scripts/bootstrap.sh` — intentionally refused the current root shell; the
  installer requires a normal user with sudo.

These are actual results, not assumptions. The signed local webhook/API/worker
path is verified; real Meta OAuth, real Meta webhook delivery, and real message
sends remain unverified and are not implemented.

## 14. Pending work roadmap

The complete prioritized backlog is in:

```text
backend/devResource/BACKEND-PENDING-TASKS.md
```

Use that document for detailed acceptance criteria. The practical order is:

### P0 — reliability and safety

1. Run the complete PostgreSQL/Redis/API/worker/signed-webhook path on a normal
   development machine.
2. Add PostgreSQL/Redis/Fastify integration tests and CI services.
3. Prove duplicate/concurrent webhook delivery and Redis failure/recovery.
4. Add authorized webhook replay by event ID/time range.
5. Add `/ready`, Redis readiness checks, dependency timeouts, and complete
   graceful shutdown behavior.
6. Harden production configuration, secret validation, rotation, and KMS token
   encryption.
7. Complete role authorization and cross-workspace isolation tests.
8. Add OpenAPI, cursor pagination, POST idempotency, rate limiting, and consistent
   request/error controls.

### P1 — usable Instagram automation

1. Confirm Meta product path, API version, scopes, endpoint fields, limits, and
   error behavior using current official documentation.
2. Verify OAuth with a real staging professional Instagram account.
3. Implement token refresh, account health, reconnect/disconnect, deauthorization,
   and webhook subscriptions.
4. Add media synchronization, contacts, templates, and object-storage handling.
5. Complete automation PATCH/DELETE/duplicate/test/retry/activity endpoints and
   publish validation.
6. Implement schedule, opt-out, blocked-user, frequency, daily-cap, plan-limit,
   and stable skip-reason planning rules.
7. Implement a typed Meta client with classified errors and bounded retries.
8. Implement separate public-reply and private-DM workers with provider IDs,
   send idempotency, messaging-window checks, rate limits, ordering, dead letters,
   and replay operations.
9. Define and implement versioned flow schemas, flow runs, delays, postbacks,
   questions, follow checks, tags, and resume behavior.

### P2 — launch capabilities

- Analytics rollups and dashboard endpoints.
- Link tracking and attribution.
- Background exports and object storage.
- Retention, deletion, monthly partitions, and Meta data-deletion callbacks.
- Billing provider, plans, trials, usage enforcement, invoices, and payment
  webhooks.
- Notifications, metrics, tracing, alerts, runbooks, deployment, backups,
  disaster recovery, load tests, and launch review.

### V2

Inbox/SSE/human takeover, teams and invites, story/DM triggers, sequences,
integrations, reports/planner/publishing, advanced insights, admin console,
staff SSO/2FA, and expanded catch-up tooling are later-phase items unless the
product owner changes the scope.

## 15. Decisions and external inputs still required

Before production-facing work, the project owner needs to provide or decide:

- Meta app ID, app secret, redirect URI, webhook URL, and staging account.
- Confirmed Meta product path, API version, permissions/scopes, fields, limits,
  messaging windows, and error codes.
- Target cloud/region, data residency, managed PostgreSQL/Redis, KMS, object
  storage, deployment, and backup choices.
- Whether self-managed authentication remains the launch model.
- Launch market, billing provider, currency, tax/invoice rules, trial length, and
  plan limits.
- Data retention/deletion duration for comments, messages, raw webhooks, logs,
  and exports.
- Expected per-account/global comment and DM volume and rate targets.
- Whether teams/agencies and Inbox are MVP or V2.
- Whether a frontend should be created now and which UI stack/design source to use.

Do not invent these decisions from the PDF. Record confirmed decisions in the
appropriate project document and keep Meta assumptions explicitly provisional.

## 16. Known documentation drift

- `backend/memory.md` is historical session memory and can contain stale task
  status. In particular, migration tracking and the transactional webhook outbox
  are implemented even where older sections describe them as pending.
- `BACKEND-PENDING-TASKS.md` also contains historical “immediate next tasks”; use
  its completed-foundation section and current source together rather than blindly
  repeating old status text.
- `backend/README.md` has authenticated mutation examples that are useful but do
  not show every session/CSRF cookie header required by the current routes.
- `META-INTEGRATION-CONTRACT.md` is intentionally provisional and must be checked
  against current Meta documentation before real credentials are enabled.

When source, notes, and memory disagree, inspect the source and tests first, then
update the relevant documentation as part of the feature or bug fix.

## 17. Safe working rules for future AI sessions

1. Read this file, then run `git status --short --branch` in both the root and
   backend repositories before editing.
2. Work in `/home/shubham/dmlinl/backend` for backend changes. Do not create a
   second backend or a new starter project.
3. Preserve the existing Node/TypeScript/Fastify/PostgreSQL/Redis/BullMQ stack.
4. Do not read, print, commit, or copy `.env`, tokens, passwords, private logs,
   Meta payloads, or local cookie files into documentation.
5. Use migrations for schema changes; do not manually alter the schema as a
   substitute for a committed migration.
6. Keep workspace and role authorization on every new resource endpoint.
7. Keep webhook, queue, provider, and send operations idempotent and classify
   retryable versus permanent failures.
8. Add or update a meaningful test for behavior changes, then run the smallest
   relevant check plus the project typecheck/build when practical.
9. Do not claim database, Redis, Meta, or API/worker behavior passed unless the
   live command was actually run and its result recorded.
10. Do not commit, push, reset, force-push, or create a pull request unless the
    user explicitly asks.

## 18. Suggested first prompt for the next session

```text
Read /home/shubham/dmlinl/PROJECT_CONTEXT.md first. Inspect git status in both
/home/shubham/dmlinl and /home/shubham/dmlinl/backend. Then inspect the exact
source files for the requested task. Preserve unrelated changes and never read
or expose .env contents. The current task is: <describe the task here>.
```

For the next backend reliability session, the most concrete starting action is:

```bash
cd /home/shubham/dmlinl/backend
git status --short --branch
RESET_DB_PASSWORD=1 ./scripts/bootstrap.sh
```

Only use `RESET_DB_PASSWORD=1` when the existing local `instagram` role is the
project's development role and its password must be synchronized. Then run the
database migration/seed, start API and worker in separate terminals, send
`npm run webhook:smoke`, and inspect the seeded automation events endpoint.
