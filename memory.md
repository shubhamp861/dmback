# Backend development memory

Last updated: 2026-10-11

Detailed actionable backlog: `devResource/BACKEND-PENDING-TASKS.md`.

## Project and current milestone

- Working directory: `/home/shubham/dmlinl/backend`
- Specification: `devResource/Backend-Specification-Instagram-Automation-Tool.pdf`
- Product: Instagram comment-to-DM automation backend.
- Stack implemented so far: Node.js, strict TypeScript, Fastify, Zod, PostgreSQL
  via `pg`, and Redis/BullMQ. Persistence currently uses handwritten SQL.
- Current milestone: an initial foundation with webhook ingestion, comment
  matching, durable webhook outbox recovery, local seed data, and a signed
  webhook smoke script. Instagram OAuth/account connection has a provisional
  implementation. Parts of
  specification Sprints 0, 1, 3, and 4 are implemented; those sprints are not
  complete.
- The worker currently stops after recording a matching result. A `queued`
  trigger event does **not** mean a DM has been enqueued for sending. Public
  replies and DMs are not sent yet.

## Session handoff — resume here

### Last completed work

- Implemented the initial backend foundation, auth/session layer, workspace
  scoping, webhook matching, transactional webhook outbox, local seed data, and
  signed webhook smoke tooling.
- Added provisional Instagram OAuth start/callback and connected-account listing.
- Added migration discovery and tracking: ordered SQL files, checksums in
  `schema_migrations`, transactional application, advisory locking, checksum/
  missing-file validation, and `db:migrate:status`.
- Added `devResource/BACKEND-PENDING-TASKS.md` as the complete implementation
  backlog and `devResource/META-INTEGRATION-CONTRACT.md` for Meta assumptions and
  verification requirements.
- Tested the Stitch MCP connection successfully after configuring the API-key
  based server. Stitch returned one project with 23 actual screens/designs.

### Current external configuration

- OmniRush Stitch MCP config: `/home/shubham/.omnirush/mcp.json`.
- Configured server: `@_davideast/stitch-mcp` using the `proxy` command.
- The API key is stored outside this repository in the OmniRush config. Do not
  copy it into source files, `memory.md`, task documents, logs, or commits.
- Latest Stitch result:
  - Project: `Design Option D Project`
  - Project ID: `10844654880021677594`
  - Actual designs/screens: `23`

### Current blockers

- Live local runtime verification is not complete because Docker and host `psql`
  were unavailable in the coding environment.
- The backend is intentionally PostgreSQL 16 plus Redis/BullMQ; Cassandra is not
  a drop-in replacement because the code and migrations use PostgreSQL pools,
  SQL, transactions, joins, locks, JSONB, and partitioning. The owner selected
  the PostgreSQL/Redis path rather than a Cassandra rewrite.
- A local development `.env` was created with the documented PostgreSQL/Redis
  URLs. Redis was started and answered `PONG`; PostgreSQL could not be started
  in this restricted container because service setup and UID switching are
  unavailable. The API returned `503 {"status":"degraded","database":"down"}`.
- Meta OAuth is not staging-verified because Meta app credentials and a real
  professional Instagram test account are not configured here.
- Official Meta documentation requests returned HTTP 400/404 in the current
  environment, so API version, scope names, endpoint fields, webhook fields,
  and limits remain provisional until verified in the Meta dashboard/docs.
- Local AES-256-GCM token encryption is present, but production KMS envelope
  encryption is still required.

### First actions when resuming

1. Read this file and `devResource/BACKEND-PENDING-TASKS.md`.
2. On a machine with Docker, run the local PostgreSQL/Redis migration, seed, API,
   worker, and webhook smoke flow from the local-development section below.
3. Add integration tests for PostgreSQL, Redis, the transactional webhook outbox,
   duplicate delivery, Redis failure/recovery, and worker processing.
4. Verify migration tracking against a fresh PostgreSQL database and implement
   authorized webhook replay.
5. Verify Meta integration decisions and run OAuth with a staging professional
   Instagram account.
6. Continue with token refresh/account subscriptions, media sync, contacts, and
   actual public/private message sending.

The full pending work, dependencies, acceptance criteria, and priority order are
in `devResource/BACKEND-PENDING-TASKS.md`; do not recreate the backlog from
memory.

## Completed implementation

### Application foundation

- TypeScript strict mode, environment loading/validation, npm lockfile, and
  development/build/test scripts.
- Fastify API with logging, CORS, Helmet, a request body size limit, and a global
  error handler.
- Separate API and matching-worker entry points: `src/server.ts` and
  `src/worker.ts`.
- PostgreSQL 16 and Redis 7 services with volumes and health checks in
  `docker-compose.yml`.
- GitHub Actions workflow for dependency installation, type checking, unit
  tests, and build.

### Database foundation

`migrations/001_initial.sql` defines workspaces, users, memberships, Instagram
accounts, media, flows, automations, contacts, webhook events, trigger events,
messages, usage counters, and audit logs.

- Trigger events use range partitioning with a default partition. Monthly
  partition creation and retention are pending.
- A separate `trigger_event_idempotency` table enforces uniqueness for
  `igAccountId:commentId:automationId`, with the key and event inserted in one
  transaction. This avoids the global uniqueness limitation on partitioned
  PostgreSQL tables.
- Webhook payloads are deduplicated by SHA-256 hash. `webhook_events` is currently
  unpartitioned. `webhook_event_outbox` is transactionally created with each
  webhook event and retried by the worker if Redis dispatch fails.
- Most tables are schema foundations only; their corresponding APIs and
  business logic remain pending.

### Webhooks and matching

- GET subscription challenge verification.
- POST HMAC-SHA256 signature verification over the raw body, with constant-time
  comparison.
- Payload validation, database persistence, and a BullMQ matching job per
  webhook payload.
- Worker extracts comment changes, loads live automations for the account,
  evaluates keywords/exclusions, and records outcomes.
- Keyword modes: contains, exact, starts-with, and regex; normalization of case,
  whitespace, and punctuation for case-insensitive non-regex rules.
- Stored skip reasons in the worker: `NO_KEYWORD_MATCH`, `EXCLUDED_WORD`, and
  `NOT_TOP_LEVEL`. The pure evaluator also supports `PAUSED`, but the worker
  currently loads only live automations.
- BullMQ retry/backoff options and worker shutdown handling are present.
- A repeated webhook now attempts to enqueue the stored event again. The
  transactional outbox now also covers recovery without a repeated Meta delivery;
  live Redis failure/recovery testing and operator replay remain pending.
- Added `scripts/migrate.ts`, which loads `.env`, runs the initial SQL in a
  transaction, and fails on errors.
- Added `scripts/seed.ts` with a local workspace, account, owner membership, and
  live `guide` automation.
- Added `scripts/send-local-webhook.ts` and `npm run webhook:smoke` to send a
  correctly signed local comment event.
- Added `GET /v1/automations/:id/events` for inspecting recorded trigger events.
- Added a transactional `webhook_event_outbox` and worker polling/retry path for
  pending, failed, and stale dispatch records.
- Added provisional Instagram OAuth start/callback, session-bound single-use
  state, long-lived token exchange, profile validation, local AES-256-GCM token
  encryption, account upsert, and `GET /v1/ig-accounts`.
- Added `devResource/META-INTEGRATION-CONTRACT.md` documenting the current Meta
  assumptions and the items that still require confirmation in the Meta app and
  current official documentation.
- Added Argon2id password hashing, signup/login/logout/me, password reset token
  storage/confirmation, opaque database-backed sessions, httpOnly session cookies,
  and double-submit CSRF cookies/tokens.
- Automation reads and mutations now require an authenticated session and scope
  queries to the session workspace. Mutations require the CSRF header.
- `db:seed` creates the local credentials `developer@example.local` /
  `local-development-password` for development only.

### Current HTTP endpoints

| Method | Path | Current behaviour |
| --- | --- | --- |
| GET | `/health` | Database connectivity check only |
| GET | `/v1/webhooks/instagram` | Meta subscription challenge |
| POST | `/v1/webhooks/instagram` | Verify, persist, enqueue matching |
| POST | `/v1/auth/signup` | Create a user/workspace and start a session |
| POST | `/v1/auth/login` | Start a session |
| POST | `/v1/auth/logout` | Revoke the current session |
| GET | `/v1/auth/me` | Return the current user/workspace/role |
| POST | `/v1/auth/reset/request` | Create a reset token; email delivery pending |
| POST | `/v1/auth/reset/confirm` | Consume a reset token and revoke sessions |
| GET | `/v1/auth/instagram/start` | Create state and redirect to Instagram OAuth |
| GET | `/v1/auth/instagram/callback` | Exchange code and connect the Instagram account |
| GET | `/v1/ig-accounts` | List connected accounts without token values |
| GET | `/v1/automations` | List the authenticated workspace's automations |
| POST | `/v1/automations` | Create a draft for an existing Instagram account |
| GET | `/v1/automations/:id` | Retrieve one automation |
| GET | `/v1/automations/:id/events` | List recorded trigger events |
| POST | `/v1/automations/:id/publish` | Set status to live |
| POST | `/v1/automations/:id/pause` | Set status to paused |
| POST | `/v1/automations/:id/resume` | Set status to live |

Authentication and basic workspace isolation are implemented. Role-specific
permissions, member management, session cleanup, reset-email delivery, and full
publish validation are still pending.

## Verification recorded

The implementation session completed these checks successfully:

- `npm ci`
- `npm run typecheck`
- `npm test` — 23 tests across auth, signature, keyword matcher, automation,
  token encryption, and Instagram OAuth URL suites.
- `npm run build`
- `git diff --check`

Docker and the host `psql` client were unavailable in this environment
(`docker: command not found`, `psql: command not found`). Live PostgreSQL
migration execution, Redis queue processing, HTTP integration tests, and real
Meta integration have **not** been verified. Passing unit tests/build does not
establish those runtime behaviours. The commands below are setup instructions,
not a record of successful local infrastructure execution.

The later runtime attempt confirmed that Node, TypeScript, unit tests, and build
work; Redis can run locally, but PostgreSQL remains unavailable in this
container. The native Debian package install also cannot complete here because
this sandbox rejects required system `chown`/UID operations. This is an
environment blocker, not a project dependency-version failure.

## Pending development — recommended order

### 1. Complete and stabilize the foundation

- [~] Run the migration and an API-to-worker smoke test against PostgreSQL/Redis.
  Attempted, but blocked here because Docker and host `psql` are unavailable.
- [ ] Add database/queue integration tests, including duplicate/concurrent
  deliveries and persistence/enqueue failures.
- [~] Add a durable outbox or equivalent recovery mechanism so events can be
  re-enqueued even when no repeated Meta delivery occurs. A transactional
  `webhook_event_outbox` and worker retry poll now exist; live Redis failure/
  recovery testing and authorized replay operations remain.
- [x] Fix compiled start paths: `npm start` and `npm run start:worker` now point
  to the emitted `dist/src/*.js` files.
- [~] Add migration tracking for future SQL files. The runner now discovers SQL
  files, records checksums, runs each migration transactionally, refuses changed
  or missing applied files, and exposes `db:migrate:status`; live database/CI
  verification remains.
- [ ] Extend schedule validation with IANA timezone validation and decide whether
  overnight schedules should be supported. Basic hour bounds and same-hour/end-
  before-start rejection are implemented.
- [x] Prevent punctuation/symbol-only normalized keywords from matching every
  comment. Add broader multilingual/emoji coverage and bound regex execution or
  use a safe matching strategy.
- [x] Implement the first auth layer: signup/login/logout/reset confirmation,
  Argon2id password hashing, database sessions, CSRF protection, and `/v1/auth/me`.
- [ ] Add reset-email delivery and generic reset-token notification handling.
- [ ] Add centralized role checks (owner/admin/editor/viewer), member management,
  session cleanup, and workspace ownership checks to every future resource.
- [ ] Generate OpenAPI from shared schemas, add pagination, POST idempotency,
  per-user/IP rate limits, and expand consistent error responses including
  request IDs.
- [ ] Finish shared-package/process structure, independent webhook deployment,
  scheduler leader locking, readiness checks, and API graceful shutdown.

### 2. Instagram connection and content — specification Sprints 1–2

- [~] Confirm current Meta product path, permissions, payload fields, API
  version, limits, and error codes against official documentation. A provisional
  contract is recorded in `devResource/META-INTEGRATION-CONTRACT.md`; docs
  requests returned HTTP 400/404 in this environment.
- [ ] Configure Meta app/test accounts and start required review/verification.
- [~] Implement session-bound single-use OAuth state, token exchange/profile
  retrieval, professional-account validation, and account persistence. Real
  staging verification is pending.
- [~] Add envelope encryption/KMS integration, permission tracking, token refresh,
  reconnect/disconnect, subscription management, and reauthorization handling.
  Local AES-GCM storage and permissions are present; KMS/refresh/lifecycle remain.
- [ ] Add webhook replay/reconciliation and update account webhook health.
- [ ] Implement media sync, pagination, thumbnail storage, templates, and
  contact creation/updating from events.

### 3. Automations and sending — specification Sprints 3–4

- [ ] Complete draft PATCH/DELETE, duplicate, test, activity, and retry endpoints.
- [ ] Validate full flows/account readiness on publish/resume and write audits.
- [ ] Enforce media selection, account status, schedules, opt-outs, blocked
  users, frequency rules, daily caps, and plan limits.
- [ ] Add delayed public-reply/private-reply jobs and Meta API adapters.
- [ ] Enforce one private reply per account/comment across automations in the
  database; existing trigger idempotency alone does not provide this guarantee.
- [ ] Add per-account rate limiting/concurrency, messaging-window checks,
  classified retries, dead-letter handling, and persisted send outcomes.
- [ ] Increment usage only after successful sends and reconcile counters.

### 4. Flows — specification Sprint 5

- [ ] Versioned flow definitions and validation, renderer, flow runs, and resume
  processing for messages/postbacks.
- [ ] Text, buttons, quick replies, images, validated questions, follow checks,
  and tag actions with messaging-window enforcement.

### 5. Insight and data lifecycle — specification Sprint 6

- [ ] Hourly analytics rollups, dashboard endpoints, and backfill tooling.
- [ ] Tracked links, attribution, background CSV exports, object storage, and
  expiring download URLs.
- [ ] Contact management/deletion, retention jobs, monthly event partitions,
  and personal-data cleanup across related records.

### 6. Billing and launch — specification Sprint 7

- [ ] Select Stripe/Razorpay; implement checkout/portal, verified idempotent
  payment webhooks, subscription/invoice records, configurable plans/trials,
  usage limits, grace periods, and add-on credits.
- [ ] Add notifications, audit actions, signed Meta data deletion/deauthorization
  callbacks, and user export/deletion.
- [ ] Add structured worker logs, metrics/traces/error tracking, alerts, runbooks,
  deployment configuration, backup/restore procedures, and dependency/container
  scanning.
- [ ] Test throttling/token failures, payment replays, late/out-of-order events,
  webhook load, and end-to-end delivery on real staging accounts.

### 7. V2 backlog from the specification

Inbox/SSE and human takeover, teams/invites and expanded roles, story/DM triggers,
sequences, integration delivery outbox, reports, planner/publishing, insights,
admin tools, and catch-up features.

### Decisions still open

Meta product path/business verification, target cloud/region, launch market and
payment/tax setup, managed versus self-built auth, retention defaults, expected
volume/rate targets, and whether agencies/inbox are included at launch. The PDF
references a separate product specification; it has not been reviewed here.

## Run locally for development

Run the following commands from `/home/shubham/dmlinl/backend`.

### 1. Prerequisites and configuration

Install Node.js (the package currently requires 20+), npm, Docker Engine, and
Docker Compose v2. Ensure Docker is running. The container-based migration
command below does not require a host installation of `psql`.

```bash
node --version
npm --version
docker --version
docker compose version
npm ci
test -f .env || cp .env.example .env
```

Edit `.env` with these development values:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
DATABASE_URL=postgres://instagram:instagram@localhost:5432/instagram_automation
REDIS_URL=redis://localhost:6379
WEB_ORIGIN=http://localhost:3001
LOG_LEVEL=info
META_APP_SECRET=local-development-app-secret
META_WEBHOOK_VERIFY_TOKEN=local-development-verify-token
```

The example Meta values work for local signature/challenge testing. Actual Meta
delivery requires the app's real secret and a matching webhook verify token.
The API and worker load `.env` automatically through `dotenv`; shell commands do
not. Keep `.env` out of version control.

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d --wait
docker compose ps
```

PostgreSQL uses port 5432; Redis uses 6379. If those ports are occupied, adjust
the Compose host ports and corresponding `.env` URLs together.

### 3. Apply the initial migration

The migration runner loads `.env`, uses a transaction, and stops on SQL errors:

```bash
npm run db:migrate
```

For a migration without a local `psql` client, use the PostgreSQL client inside
the container:

```bash
docker compose exec -T postgres psql -U instagram -d instagram_automation -v ON_ERROR_STOP=1 --single-transaction < migrations/001_initial.sql
```

The initial migration is currently the only migration file; migration history
tracking is still pending. Seed repeatable local data after the migration:

```bash
npm run db:seed
```

### 4. Start the API and worker

Terminal 1:

```bash
npm run dev
```

Terminal 2, from the same project directory:

```bash
npm run dev:worker
```

Both processes are needed for webhook-to-matching processing. Changes restart
them automatically through `tsx watch`.

### 5. Smoke checks

```bash
curl --fail-with-body http://localhost:3000/health
curl --fail-with-body -c .local-cookies -X POST http://localhost:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"developer@example.local","password":"local-development-password"}'
curl --fail-with-body -b .local-cookies http://localhost:3000/v1/auth/me
curl --fail-with-body -b .local-cookies http://localhost:3000/v1/automations
curl --fail-with-body 'http://localhost:3000/v1/webhooks/instagram?hub.mode=subscribe&hub.verify_token=local-development-verify-token&hub.challenge=12345'
npm run webhook:smoke
curl --fail-with-body -b .local-cookies http://localhost:3000/v1/automations/44444444-4444-4444-8444-444444444444/events
```

Expected responses: `{"status":"ok","database":"up"}`, a seeded automation
from `GET /v1/automations`, and the text `12345`. The smoke command should return
HTTP 200 and enqueue a `guide` trigger event for the seeded automation. Adjust the
verify token if you changed it. The health route checks PostgreSQL only; it does
not establish Redis readiness.

Creating an automation requires an existing `ig_accounts` row linked to a
workspace. `npm run db:seed` creates a local account with ID
`33333333-3333-4333-8333-333333333333`, so the automation API and signed webhook
smoke script can be exercised without OAuth. The seed account is local-only and
is not connected to Meta.

### 6. Development checks and compiled execution

```bash
npm run typecheck
npm test
npm run build
```

For compiled execution, start each process in its own terminal from the project
root:

```bash
npm start
```

```bash
npm run start:worker
```

These scripts run `dist/src/server.js` and `dist/src/worker.js` after
`npm run build`.

### 7. Logs and shutdown

```bash
docker compose logs -f postgres redis
```

Stop API/worker terminals with Ctrl+C, then stop the infrastructure:

```bash
docker compose down
```

Named volumes retain development data between runs. If Docker is unavailable,
provide PostgreSQL 16 and Redis 7 separately, set their URLs in `.env`, and apply
the SQL migration with a local `psql` client.
