# Instagram Automation Backend — Pending Development Tasks

## Document purpose

This is the actionable implementation backlog for the backend described in:

`devResource/Backend-Specification-Instagram-Automation-Tool.pdf`

The list reflects the current repository state as of 2026-10-17. It separates
completed foundation work from work that still needs implementation, verification,
product decisions, or Meta approval.

## Status legend

- `[ ] Pending` — not implemented or not verified.
- `[~] In progress/partial` — a foundation exists, but the production behaviour
  is incomplete.
- `[x] Complete` — implemented and locally verified at unit/build level.
- **P0** — blocks reliable local/staging development or data safety.
- **P1** — required for the first usable Instagram automation release.
- **P2** — launch hardening or important supporting capability.
- **V2** — explicitly listed as a later-phase feature in the specification.

## Current repository baseline

### Completed foundation

- `[x]` Strict TypeScript Node.js service using Fastify, Zod, PostgreSQL, Redis,
  and BullMQ.
- `[x]` Docker Compose definition for PostgreSQL 16 and Redis 7.
- `[x]` Initial SQL schema for workspaces, users, memberships, Instagram
  accounts, media, flows, automations, contacts, webhook events, trigger events,
  messages, usage counters, and audit logs.
- `[x]` Fastify health route and global error handling.
- `[x]` GET Instagram webhook challenge verification.
- `[x]` Raw-body HMAC-SHA256 webhook signature validation.
- `[x]` Webhook payload validation, persistence, duplicate hash detection, and
  BullMQ enqueue boundary.
- `[x]` Worker-side comment extraction, keyword matching, exclusion matching,
  top-level comment filtering, and stored trigger outcomes.
- `[x]` Trigger idempotency companion table and transactional insert logic.
- `[x]` Local migration script, repeatable seed script, and signed webhook smoke
  script.
- `[x]` Argon2id password hashing, database sessions, auth cookies, CSRF token
  validation, signup/login/logout/me, and basic workspace-scoped automation
  queries.
- `[x]` Unit tests, TypeScript checks, production build, CI workflow, and local
  development documentation.

### Important current limitations

- `[~]` A queued trigger event is only a matching result. No public reply or DM
  is sent to Instagram yet.
- `[~]` Meta OAuth start/callback, local encrypted token storage, and account
  listing are implemented, but real Meta credentials, current API confirmation,
  KMS encryption, refresh, subscriptions, and staging verification are pending.
- `[~]` Authentication exists, but role-specific authorization is not complete.
- `[~]` SQL schema and migration history exist, and the native local
  database/Redis/API/worker path has been verified. Retention, monthly
  partitions, and automated database/Redis integration tests are still pending.
- `[~]` API endpoints are incomplete, lack OpenAPI generation, cursor pagination,
  broad idempotency support, and per-user/IP rate limits.
- `[~]` Password reset confirmation exists, but reset-email delivery is not
  implemented.
- `[~]` Transactional webhook outbox recovery and polling are implemented and the
  normal local path is verified, but live Redis failure/recovery testing, admin
  replay, and classified Instagram send retries remain pending.

## Required decisions and external prerequisites

These decisions should be resolved before the related implementation begins.

| ID | Priority | Decision/prerequisite | Owner/input needed | Blocks |
| --- | --- | --- | --- | --- |
| DEC-001 | P0 | Confirm the Meta product path, API version, permissions/scopes, webhook fields, message limits, and error codes against current official Meta documentation. | Backend + product | OAuth, webhook production use, sending |
| DEC-002 | P0 | Confirm the target cloud, region, data residency, object storage, KMS, and managed PostgreSQL/Redis providers. | Engineering/product | Encryption, deployment, retention |
| DEC-003 | P0 | Provide a Meta app, app secret, redirect URI, webhook URL, and staging/test Instagram professional account. | Meta app owner | OAuth and end-to-end staging tests |
| DEC-004 | P1 | Decide launch authentication model: keep self-managed auth or use a managed provider. | Product/security | Auth hardening and operations |
| DEC-005 | P1 | Decide launch market, payment provider, currency, tax/invoice requirements, trial length, and plan limits. | Product/finance | Billing implementation |
| DEC-006 | P1 | Define message/comment retention defaults and deletion/export behaviour. | Product/legal | Privacy, analytics, purge jobs |
| DEC-007 | P1 | Define expected launch volume and burst limits per account and globally. | Product/infra | Queue sizing and rate limiter |
| DEC-008 | P1 | Decide whether agencies, teams, and Inbox are launch features or V2. | Product | Membership model and V2 scope |

## Recommended execution order

1. Complete P0 runtime verification and data-safety work.
2. Complete Meta documentation confirmation and Instagram account connection.
3. Add media/contact synchronization and finish automation CRUD/publish rules.
4. Implement public/private message sending with limits, retries, and idempotency.
5. Implement flows and postback/message resume behaviour.
6. Add analytics, links, exports, retention, and deletion.
7. Add billing, notifications, observability, load testing, and launch review.
8. Start V2 only after MVP send reliability and operational recovery are proven.

---

# P0 — Foundation and runtime reliability

## P0-001 — Verify the complete local runtime

**Status:** `[~] Partial`  
**Dependencies:** Docker, Node.js 20+, project `.env`

### Work

- Start PostgreSQL and Redis with `docker compose up -d --wait`.
- Run `npm run db:migrate` and `npm run db:seed`.
- Start the API and worker in separate terminals.
- Verify health, login, authenticated automation listing, signed webhook
  delivery, queue processing, and trigger event inspection.
- Record a successful runtime verification separately from unit/build checks.

### Acceptance criteria

- PostgreSQL migration completes with `ON_ERROR_STOP` behaviour.
- Seed is repeatable and does not create duplicate rows.
- API health reports PostgreSQL availability.
- Worker consumes the local webhook job from Redis.
- One `guide` comment produces one trigger event for the seeded automation.
- Replaying the same payload does not create a second trigger event.
- A failed API/worker dependency is visible in logs and does not silently lose
  an accepted event.

### Verification

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:seed
npm run dev
npm run dev:worker
npm run webhook:smoke
```

Docker alternative for the infrastructure portion:

```bash
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
npm run dev:worker
npm run webhook:smoke
```

### Current verification result

The native runtime path was verified on 2026-10-17 after configuring the local
`instagram` PostgreSQL role and `instagram_automation` database. Migration and
seed completed, Redis returned `PONG`, API health returned
`{"status":"ok","database":"up"}`, the signed webhook returned HTTP 200,
and the worker recorded one `queued` `guide` trigger after duplicate delivery.
The Docker-specific path and dependency-failure recovery scenarios still need
separate verification.

## P0-002 — Add database migration tracking

**Status:** `[~] In progress/partial`  
**Dependencies:** P0-001

### Work

- Create a `schema_migrations` table with migration name, checksum, and applied
  timestamp.
- Make the migration runner discover ordered SQL files instead of hardcoding
  `001_initial.sql`.
- Refuse to continue when a previously applied migration checksum changes.
- Make each migration transactional where PostgreSQL supports it.
- Add a command to display migration status.

### Implemented in the current foundation

- `schema_migrations` stores migration name, SHA-256 checksum, and applied time.
- The runner discovers numerically ordered SQL files instead of hardcoding the
  initial migration.
- Applied migration changes and missing migration files fail validation before
  new migrations run.
- Each new migration runs in its own transaction under a PostgreSQL advisory lock.
- `npm run db:migrate:status` reports applied, pending, modified, and missing
  migrations.

### Acceptance criteria

- Running migrations twice is a no-op.
- A new migration runs exactly once.
- A modified applied migration fails with a useful error.
- CI can run migrations against a fresh database.

### Still required

- Run the migration and status commands against PostgreSQL in Docker/CI.
- Add a CI integration check covering a fresh database, rerun, new migration, and
  checksum failure.

## P0-003 — Implement durable webhook event recovery

**Status:** `[~] Partial`  
**Dependencies:** P0-001, P0-002

### Replay implementation update — 2026-10-19

- Added `POST /v1/webhook-events/:id/replay` for Owner/Admin sessions with CSRF.
  Actor/workspace come only from the session. Unknown/foreign/mixed/unsupported
  payloads use the same safe 404 response; no partial cross-workspace replay.
- New migration `002_webhook_replays.sql` stores independent replay dispatch and
  processing states. Request and minimal immutable audit insert are atomic.
- Every accepted call creates a new replay UUID/job, independently audited.
  Retained original completed/failed jobs do not swallow replay. Dispatch retries
  reuse that replay ID; trigger idempotency keys remain unchanged.
- Ownership is checked at request/processing and at scoped trigger insertion.
  Completed replay redelivery is a no-op. Matching uses current live rules;
  replay is not message resend and does not clear historical trigger outcomes.
- Worker polls replay requests through the same serial/drainable poll lifecycle.
  Redis failure preserves accepted requests; claims have stale lease recovery.
- Verification: 293 unit/HTTP-double tests across 20 files passed, plus typecheck
  and build. The suite includes replay permission/CSRF, payload-ownership,
  audit-failure rollback commands, scoped processing and stable queue ID checks.
- Six real-service replay scenarios were added (14 integration cases total).
  Integration setup is blocked in automation by test PostgreSQL connection
  refusal at 127.0.0.1:55432; migration/live replay behavior is NOT verified here.
  Apply the migration and run the dedicated integration suite on Windows.
- Remaining: bounded time-range/bulk replay, rate limits, audit/status API or
  operator UI, real Redis restart/process-signal tests, and a successful live
  replay/CI receipt. New replay foreign keys need a retention/deletion policy.

### Work

- Add an outbox table or a persisted queue-dispatch status to `webhook_events`.
- Store enqueue attempts, queue name, job ID, last error, and next retry time.
- Use a transaction to persist the webhook event and dispatch record together.
- Add a scheduler/worker that retries undispatched events.
- Keep BullMQ job IDs idempotent.
- Add an admin-safe replay operation by event ID and time range.

### Acceptance criteria

- A PostgreSQL commit followed by Redis failure eventually results in a queued
  job without requiring another Meta delivery.
- A Redis retry cannot create duplicate matching effects.
- An operator can replay a stored event safely.
- Every permanently skipped or failed dispatch has a stored reason code.

### Implemented in the current foundation

- `webhook_event_outbox` is written in the same transaction as
  `webhook_events`.
- API delivery attempts mark the outbox dispatched or failed.
- The worker polls pending/failed/stale dispatch records and retries them with
  the BullMQ job ID set to the webhook event ID.

### Still required

- Live Redis failure/recovery test.
- Windows/CI verification of implemented event-ID replay; time-range replay and
  operational dashboard remain unimplemented.

## P0-004 — Add readiness, liveness, and graceful shutdown

**Status:** `[~] Implemented foundation; live process/outage verification pending`  
**Dependencies:** P0-001

### Update — 2026-10-19

- `/health` and `/live` now provide dependency-independent liveness.
- `/ready` checks PostgreSQL and Redis concurrently with a bounded deadline;
  failed checks return HTTP 503 with safe `unavailable`/`timeout` states.
- API and worker have idempotent, deadline-bounded SIGINT/SIGTERM handling.
- Worker outbox polls do not overlap and are drained before dependency close.
- Redis producer operations fail fast while disconnected; PostgreSQL pool/query
  operations have finite timeouts, and connection errors have listeners.
- Unit/Fastify injection checks cover readiness success/failure/timeouts,
  polling drain/non-overlap, and shutdown ordering/idempotency/deadline.
- Still required: live Windows Docker dependency outage/recovery, OS-signal
  checks with active jobs, and independent confirmation of recovery after a
  forced shutdown. Do not treat mock-based checks as those live results.

### Work

- Keep `/health` as a lightweight liveness route.
- Add `/ready` that checks PostgreSQL and Redis connectivity.
- Add BullMQ/Redis connectivity monitoring.
- Add API shutdown handling that stops accepting requests, closes queues, and
  closes database pools.
- Add worker shutdown handling that waits for active jobs or reports interrupted
  jobs for retry.
- Add dependency timeouts so health checks do not hang.

### Acceptance criteria

- Liveness stays available when a dependency is unavailable.
- Readiness returns non-2xx when PostgreSQL or Redis is unavailable.
- SIGTERM does not abandon an active job without a retry/recovery record.
- Container orchestration can use the two endpoints correctly.

## P0-005 — Harden configuration and secrets

**Status:** `[~] Runtime validation/logging foundation implemented; KMS/rotation pending`  
**Dependencies:** P0-001, DEC-002

### Update — 2026-10-19

- Staging/production require explicit core credentials and endpoint settings;
  recognized default/placeholder values, short Meta/webhook secrets, insecure
  callback/origin/Meta URLs, malformed encryption keys and default key material
  fail startup. Development/test defaults remain usable.
- All modes check PostgreSQL/Redis schemes and canonical 32-byte base64 keys.
  Config errors expose only field names and reviewed static reasons.
- Added an intentionally non-runnable `.env.production.example` template and
  documented TLS decisions, secure cookies, and key preservation requirements.
- Runtime error/request serialization is allowlisted; automatic request logs
  are disabled, request IDs are generated locally, sensitive structured fields
  are redacted, and generic HTTP/OAuth errors no longer echo exception text.
- API/worker outbox failure reasons now use `QUEUE_DISPATCH_FAILED`. Production
  worker processor exceptions are sanitized before BullMQ stores diagnostics.
  Existing historical diagnostics/errors are not modified.
- Typecheck/build passed; 254 unit/HTTP-double tests passed across 17 files,
  including config, logging output, route response/cookie and failure persistence
  regression checks. No dependency installation or Linux service setup was run.
- Still pending: chosen KMS provider, envelope encryption/rotation/key migration,
  access auditing, deployment-specific TLS/secret-manager integration, and a
  production security review. Placeholder heuristics do not prove entropy;
  runtime redaction is not a general arbitrary-string scrubber.

### Work

- Add explicit production validation for Meta, session, database, Redis, KMS,
  object storage, and email settings.
- Reject development default secrets in staging/production.
- Add secret rotation support and document rotation procedures.
- Ensure tokens, passwords, cookies, reset tokens, and Meta error payloads are
  never logged.
- Add environment-specific configuration examples.

### Acceptance criteria

- Missing production secrets fail startup before serving requests.
- Sensitive values do not appear in pino logs, errors, or analytics.
- Secret rotation can occur without data loss or forced global downtime where
  practical.

## P0-006 — Complete authorization and workspace isolation

**Status:** `[~] Partial`  
**Dependencies:** Current auth foundation

### Update — 2026-10-19

Central deny-by-default role permissions now protect the existing account,
automation, trigger-event, and Instagram OAuth routes. Owner/Admin can connect
accounts; Owner/Admin/Editor can mutate automations; Viewer can only read.
Unknown roles are denied. Session and mutation CSRF checks remain in place.
Route tests cover the role matrix, early denial without service calls, required
CSRF, workspace argument forwarding, and safe 404 responses for foreign IDs.
These use mocked database services: real PostgreSQL isolation, membership
management, and audit recording remain pending.

### Work

- Add a centralized authorization policy layer.
- Enforce Owner/Admin/Editor/Viewer permissions from the specification.
- Add workspace membership queries and role checks to every resource.
- Prevent an authenticated user from accessing another workspace by ID, account
  ID, automation ID, contact ID, media ID, or event ID.
- Add membership management and invitation flows if included in MVP.
- Add audit records for login, account connection, publish, pause, export,
  deletion, billing, and administrative actions.

### Acceptance criteria

- Viewer cannot mutate resources.
- Editor cannot connect accounts or manage billing/team membership.
- Admin cannot delete a workspace or manage billing unless the product decision
  changes the role matrix.
- Cross-workspace IDs always return a safe not-found/forbidden response.
- Authorization tests cover every protected route.

## P0-007 — Finish API contract and request controls

**Status:** `[ ] Pending`  
**Dependencies:** P0-006

### Work

- Generate OpenAPI from Zod/shared schemas.
- Publish a versioned OpenAPI document for frontend client generation.
- Standardize error responses as `code`, `message`, `fields`, and `requestId`.
- Add cursor pagination to list endpoints.
- Add `Idempotency-Key` support to state-changing POST endpoints.
- Add per-user and per-IP rate limits, with stricter webhook protection where
  appropriate.
- Add content-type, body-size, CORS, and origin tests.
- Update README examples so authenticated mutation requests include cookies and
  CSRF headers.

### Acceptance criteria

- Frontend can generate a client from the published OpenAPI document.
- Repeated idempotent requests return the original result.
- Pagination is stable under inserts and uses opaque cursors.
- Rate limits return a documented error and retry metadata.

## P0-008 — Add integration and system test infrastructure

**Status:** `[~] Test infrastructure implemented; live verification pending`  
**Dependencies:** P0-001

### Update — 2026-10-19

- Added a dedicated `test:integration` Vitest suite and disposable Windows
  Docker test services, separate ports/data from development infrastructure.
- CI now provisions PostgreSQL 16/Redis 7 for a separate integration job.
- Worker processing/outbox dispatch are reusable functions shared by production
  and integration tests. Optional `QUEUE_PREFIX` isolates each run's Redis jobs.
- Added real-service scenarios for signed concurrent/duplicate and out-of-order
  webhooks, Redis transport failure/outbox recovery, concurrent claims/stale
  leases, SQL workspace isolation, role changes, and transactional rollback.
- Safeguards require a database ending `_test` and Redis DB `/15`; random SQL
  schemas/queue prefixes prevent collision, and cleanup never flushes Redis.
- Typecheck/build and 206 unit/HTTP-double tests passed. Integration execution
  failed during setup with `ECONNREFUSED 127.0.0.1:55432`; test services/Docker
  are unavailable in the automation environment. These real-service scenarios
  are implemented but NOT recorded as passed. Run the README Windows commands.
- Still pending: successful live suite/CI receipt, real server restart/failover
  and active-job OS-signal tests, mock Meta server scenarios, k6 load tests,
  migration-runner history integration, and real Meta staging test plan.

### User-reported Windows verification follow-up

The user subsequently reported that the tests looked good and authorized the
next implementation step. Treat this as user-reported successful Windows
testing, not an independently captured integration or CI receipt. The security
changes above have not been reverified against live Windows test services by
the automation environment.

### Work

- Add PostgreSQL and Redis integration test services in CI.
- Add Fastify HTTP tests using an isolated database/schema.
- Add queue tests for duplicate, late, out-of-order, and concurrent webhooks.
- Add a mock Meta server for success, 4xx, 5xx, timeout, throttling, expired
  token, deleted comment, and policy rejection responses.
- Add payment webhook replay tests when billing starts.
- Add k6 webhook receiver/queue load tests.

### Acceptance criteria

- CI verifies real SQL and Redis behaviour, not only pure functions.
- Tests prove idempotency under concurrent delivery.
- Failure classifications and retry limits are asserted.
- A staging end-to-end test plan exists for a real test Instagram account.

---

# P1 — Instagram account connection and content

## P1-001 — Confirm and record Meta API compatibility

**Status:** `[~] Partial`  
**Dependencies:** DEC-001, DEC-003

### Work

- Verify the current Instagram product path and Graph API version.
- Verify exact OAuth scopes/permissions for profile, comments, messaging,
  webhooks, insights, and publishing if applicable.
- Verify current endpoint paths, request fields, response fields, limits, and
  error codes.
- Confirm supported account types and professional-account requirements.
- Record decisions in a versioned Meta integration document.
- Add contract fixtures based on confirmed payloads.

### Acceptance criteria

- No `[confirm]` item from the PDF is used in production code without a recorded
  current Meta documentation reference.
- API version is pinned in configuration.
- Test fixtures match real staging payloads.

The current assumptions and verification result are recorded in
`devResource/META-INTEGRATION-CONTRACT.md`. Official Meta documentation requests
returned HTTP 400/404 in the current environment, so the configured v23.0
defaults and scope names must be confirmed in the Meta dashboard before staging.

## P1-002 — Implement Instagram OAuth start/callback

**Status:** `[~] Partial`  
**Dependencies:** P1-001, P0-006

### Work

- Add `GET /v1/auth/instagram/start`.
- Add `GET /v1/auth/instagram/callback`.
- Create a signed, single-use state value bound to the authenticated user/session,
  workspace, redirect URI, and expiry.
- Exchange authorization code for the required token(s) in a worker/service
  boundary, not in an untrusted request path where practical.
- Fetch profile/account metadata.
- Validate that the account is a supported professional account.
- Return typed frontend-safe errors such as `INSTAGRAM_ACCOUNT_TYPE_REQUIRED`.

### Acceptance criteria

- Missing, reused, expired, modified, or wrong-session state is rejected.
- Authorization codes cannot be replayed.
- Tokens and authorization codes never appear in logs or URLs stored in analytics.
- Unsupported account types return a stable frontend-mappable error.

### Implemented in the current foundation

- Session-bound, ten-minute, single-use OAuth state.
- Authorization URL generation at `/v1/auth/instagram/start`.
- Callback code exchange, long-lived token exchange, profile lookup, professional
  account validation, and safe error codes.
- Connected account persistence and workspace-scoped `GET /v1/ig-accounts`.

### Still required

- Real Meta credentials and staging verification.
- Redirect/callback frontend completion handling.
- Confirmed scopes/endpoints and exact profile response fields.

## P1-003 — Add token encryption and account lifecycle

**Status:** `[~] Partial`  
**Dependencies:** P1-002, DEC-002

### Work

- Implement envelope encryption with a per-row data key and KMS/master key.
- Store encrypted tokens, token expiry, granted permissions, API version, and
  account status.
- Add `GET /v1/ig-accounts` with health/permission metadata and no token values.
- Add reconnect and disconnect endpoints.
- Handle user-initiated disconnect and Meta deauthorization callback.
- Support user-selected data retention/deletion behaviour.
- Pause all related automations on invalid/revoked tokens with `TOKEN_INVALID`.

### Acceptance criteria

- Database contains ciphertext only, never plaintext access tokens.
- API responses never expose token material.
- Disconnect revokes/invalidates future sending and records an audit event.
- Account state transitions are idempotent.

### Implemented in the current foundation

- AES-256-GCM ciphertext storage using `TOKEN_ENCRYPTION_KEY` for development.
- Account type, profile picture URL, permissions, token expiry, and account
  status fields.

### Still required

- KMS-backed envelope encryption with per-row data keys and key rotation.
- Reconnect/disconnect operations and Meta deauthorization handling.
- Token refresh and account health scheduler.

## P1-004 — Implement token refresh scheduler

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P0-004

### Work

- Add a scheduler process with a single-instance leader lock.
- Find tokens expiring within the configured window.
- Refresh and atomically update token ciphertext and expiry.
- Mark accounts `needs_reauth` after terminal refresh failure.
- Pause automations and create user notifications.
- Add metrics for expiry, refresh success, and refresh failure.

### Acceptance criteria

- Two scheduler instances cannot refresh the same account concurrently.
- Refresh failure does not delete the account or automation data.
- Users receive a stable reason and reauthorization path.

## P1-005 — Subscribe and maintain Meta webhooks

**Status:** `[ ] Pending`  
**Dependencies:** P1-001, P1-003

### Work

- Subscribe connected accounts to confirmed webhook fields.
- Store subscription status and last successful subscription attempt.
- Retry temporary subscription errors.
- Process deauthorization and subscription removal callbacks.
- Update `last_webhook_at` when an account receives a valid event.
- Add account-level webhook health reporting.

### Acceptance criteria

- Connecting an account results in a confirmed subscription or a clear setup
  error.
- Reconnect is safe to repeat.
- Account health identifies stale/missing webhook delivery.

## P1-006 — Add webhook replay and reconciliation

**Status:** `[~] Event-ID replay implemented; live verification and reconciliation pending`  
**Dependencies:** P0-003, P1-005

### Work

- Add an internal/admin replay command by event ID and time range.
- Add a reconciliation job for live automations that fetches recent comments.
- Compare Meta comments against stored event/comment IDs.
- Enqueue unseen comments only.
- Rate-limit reconciliation per account.
- Persist reconciliation runs, failures, and counts.

### Acceptance criteria

- Dropped webhooks are recovered without duplicate private replies.
- Late/out-of-order events do not alter historical outcomes incorrectly.
- Reconciliation is observable and safe to rerun.

## P1-007 — Implement media synchronization

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P1-001

### Work

- Add `GET /v1/media`, `POST /v1/media/sync`, and `GET /v1/media/:id`.
- Fetch media with cursor pagination.
- Store media ID, caption, type, product type, permalink, and timestamp.
- Copy expiring thumbnail URLs to object storage.
- Make sync idempotent and rate-limited per account.
- Track deleted/unavailable media safely.

### Acceptance criteria

- Repeated sync does not duplicate media.
- Expiring Meta URLs are not used as permanent application URLs.
- Automation media selection can reference only media in the current workspace.

## P1-008 — Implement contacts and templates foundation

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P1-005

### Work

- Upsert contacts from comment/message events by `(ig_account_id, igsid)`.
- Store username/name and first/last seen timestamps.
- Add opt-out and tag mutation support.
- Add `GET/PATCH/DELETE /v1/contacts/:id` and list filters/search.
- Add templates list/create/delete with system-template read-only rules.
- Add contact deletion cascade/purge behaviour.

### Acceptance criteria

- Contact identity is unique per Instagram account.
- Opted-out contacts are excluded before planning sends.
- System templates cannot be modified or deleted by workspace users.

---

# P1 — Automations, planning, and sending

## P1-009 — Complete automation CRUD

**Status:** `[~] Partial`  
**Dependencies:** P0-006, P1-007, P1-008

### Work

- Add `PATCH /v1/automations/:id` for partial draft updates.
- Add `DELETE /v1/automations/:id` with required soft-delete policy.
- Add duplicate endpoint with new version/identity and audit event.
- Add test endpoint that validates without sending or sends through a safe test
  adapter.
- Add activity filters by outcome/reason and cursor pagination.
- Add retry endpoint with allowed-reason checks.

### Acceptance criteria

- Draft updates validate shared schemas.
- Live automations cannot be changed in ways that invalidate active runs.
- Delete/pause/resume operations are idempotent and audited.
- Retry cannot retry permanent failures.

## P1-010 — Implement publish validation

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P1-007, P1-009

### Work

- Validate account status and token health.
- Validate keyword rules, exclusions, response content, selected media, flow
  reference, schedule, and platform limits.
- Validate that referenced flow versions exist and are publishable.
- Validate plan limits and number of live automations.
- Return structured field-level errors.
- Write publish/pause/resume audit records.

### Acceptance criteria

- Invalid automations cannot become `live`.
- A published automation has an immutable validated configuration/version.
- Publish errors contain stable codes and frontend-safe messages.

## P1-011 — Implement planning constraints and reason codes

**Status:** `[ ] Pending`  
**Dependencies:** P1-009, P1-010, DEC-007

### Work

- Add schedule-window evaluation using IANA timezone data.
- Decide and implement overnight schedule semantics.
- Check blocked users, opt-outs, top-level status, frequency rules, daily caps,
  plan caps, and account pause state.
- Add plan/daily Redis counters with PostgreSQL reconciliation.
- Store every skip reason from the specification:
  `NO_KEYWORD_MATCH`, `EXCLUDED_WORD`, `ALREADY_SERVED`, `OUTSIDE_SCHEDULE`,
  `DAILY_CAP`, `PLAN_LIMIT`, `BLOCKED_USER`, `OPTED_OUT`, `NOT_TOP_LEVEL`,
  `PAUSED`.

### Acceptance criteria

- Every skipped trigger event contains exactly one stable reason code.
- A cap race cannot exceed the configured limit under concurrent jobs.
- Counters recover correctly after Redis restart/reconciliation.
- No event is silently dropped because a cap is reached.

## P1-012 — Implement Meta API client and classified errors

**Status:** `[ ] Pending`  
**Dependencies:** P1-001, P1-003

### Work

- Create a typed Meta HTTP client with configured API version and timeouts.
- Add request correlation IDs without logging tokens or unnecessary PII.
- Parse confirmed Meta error shapes into internal classes:
  auth, rate limit, temporary, permanent-per-message, and policy block.
- Add bounded exponential backoff with jitter for temporary/rate errors.
- Add circuit/pause behaviour for account-level policy blocks.
- Add mock server fixtures for each error class.

### Acceptance criteria

- Raw Meta error text is not returned to frontend users.
- Error classification determines retry or terminal outcome.
- Account auth failures transition to `needs_reauth`.
- Rate-limit responses lower sending pressure and expose a delayed status.

## P1-013 — Implement public reply and private reply workers

**Status:** `[ ] Pending`  
**Dependencies:** P1-011, P1-012

### Work

- Add separate BullMQ jobs for public replies and private replies.
- Send public reply through the confirmed comment reply endpoint.
- Send first private reply using the comment recipient mechanism.
- Store outbound messages and provider message IDs.
- Enforce one private reply per `(ig_account_id, comment_id)` with a database
  uniqueness constraint/claim table.
- Use queue job IDs based on account/comment/automation/kind.
- Mark trigger event state as queued/sent/failed and record attempts.

### Acceptance criteria

- A duplicate webhook cannot cause a second private reply.
- Public reply and private DM failures are tracked independently.
- Successful sends increment usage exactly once.
- Permanent failures store a documented reason code.

## P1-014 — Add account rate limiting and send ordering

**Status:** `[ ] Pending`  
**Dependencies:** P1-013, DEC-007

### Work

- Implement Redis token bucket per Instagram account.
- Restrict account concurrency to one or two workers as configured.
- Add delayed jobs for random/send-window delays.
- Preserve ordering where required while allowing independent public/DM jobs.
- Add queue depth and oldest-job metrics.

### Acceptance criteria

- Burst traffic does not exceed the configured account rate.
- Rate limiter state survives worker scaling sufficiently for the chosen design.
- Delayed jobs are rejected at publish time when they can exceed the message
  window.

## P1-015 — Enforce messaging windows and follow-up replies

**Status:** `[ ] Pending`  
**Dependencies:** P1-013, P1-014

### Work

- Store inbound and outbound messages with source and direction.
- Detect messaging-window expiry from confirmed Meta rules.
- Add follow-up DM sending only after an allowed user reply/tap.
- Return/store `REPLY_WINDOW_PASSED` when sending is not allowed.
- Add user-friendly frontend-safe reason mappings.

### Acceptance criteria

- No follow-up is sent outside the allowed window.
- Human/user replies can resume allowed follow-up processing.
- Window failures are terminal per message and are not retried.

## P1-016 — Add dead-letter and replay operations

**Status:** `[ ] Pending`  
**Dependencies:** P1-012, P1-013

### Work

- Configure dead-letter queues per job class.
- Persist final failure reason, attempts, last provider code, and timestamps.
- Add staff/admin replay with authorization and audit records.
- Prevent replay of permanent policy/auth failures unless explicitly overridden.
- Add dashboard/query endpoint for failed jobs.

### Acceptance criteria

- Exhausted temporary jobs are visible and replayable.
- Replaying a job preserves idempotency.
- Sensitive provider payloads are redacted in the replay UI/logs.

---

# P1 — Flow engine

## P1-017 — Define versioned flow schema

**Status:** `[ ] Pending`  
**Dependencies:** P1-009, DEC-008

### Work

- Define Zod schemas for text, buttons, quick replies, image, question,
  follow-check, tag, condition, delay, handoff, and future webhook steps.
- Assign stable step IDs and flow versions.
- Validate branch targets and unreachable steps.
- Validate platform limits for text/buttons/quick replies.
- Make schemas available to backend and frontend through a shared package.

### Acceptance criteria

- Invalid flow graphs fail publish validation with field/step errors.
- A published flow version is immutable.
- Frontend and backend use the same schema and rendering constraints.

## P1-018 — Implement flow runs and executor

**Status:** `[ ] Pending`  
**Dependencies:** P1-017, P1-013

### Work

- Add `flow_runs` persistence with current step, variables, status, and expiry.
- Implement executor loop until input/delay/handoff is reached.
- Store answers, tags, and contact updates.
- Add delayed flow-resume jobs.
- Cancel active runs on human takeover.
- Enforce messaging-window expiry before scheduling delays.

### Acceptance criteria

- Runs are idempotent by event/postback/message key.
- A crash can resume a run from the last committed step.
- Active/waiting/completed/cancelled states are queryable.
- A run never schedules a send after its window expires.

## P1-019 — Implement postback, message, and question resume

**Status:** `[ ] Pending`  
**Dependencies:** P1-018, P1-015

### Work

- Parse confirmed Meta postback and inbound message payloads.
- Find waiting runs by contact and account.
- Resume button and quick-reply branches.
- Validate email and phone answers.
- Re-ask invalid answers once, then hand off/cancel according to product rules.
- Implement follow-check branch and one-nudge limit.

### Acceptance criteria

- Duplicate postbacks do not advance a run twice.
- Valid answers persist on the contact/lead record.
- Invalid answers follow the one-reask rule.
- Incoming events for another workspace/account cannot resume a run.

---

# P2 — Analytics, links, privacy, and lifecycle

## P2-001 — Implement analytics rollups

**Status:** `[ ] Pending`  
**Dependencies:** P1-013, P1-018

### Work

- Add hourly stats rollups per automation and media.
- Aggregate comments, matches, skips by reason, replies, DMs, failures, and
  link clicks.
- Add analytics overview, by-automation, by-media, keywords, and heatmap routes.
- Support date range, comparison, and tag filters.
- Add a backfill command from the event log.

### Acceptance criteria

- Dashboards read rollups, while detail pages read event records.
- Backfill is idempotent and produces the same result as live aggregation.
- Analytics excludes deleted personal data according to retention rules.

## P2-002 — Implement link tracking

**Status:** `[ ] Pending`  
**Dependencies:** P1-017, P2-001

### Work

- Add short-code/link records associated with automation and contact.
- Add `GET /l/:code` redirect route.
- Validate destination URLs and reject unsafe schemes/internal SSRF targets.
- Record click time, account, automation, media, and contact attribution.
- Return redirects without exposing unnecessary personal data.

### Acceptance criteria

- `javascript:`, `data:`, internal, and malformed destinations are rejected.
- Link clicks are attributed exactly once according to the product rule.
- Expired/deleted links produce a safe response.

## P2-003 — Implement exports

**Status:** `[ ] Pending`  
**Dependencies:** P0-006, P2-001, DEC-006

### Work

- Add background export jobs for contacts/events/analytics.
- Stream rows rather than loading all rows in memory.
- Write export files to object storage.
- Return signed expiring URLs or expose completed exports in the UI.
- Enforce column permissions and deletion/retention rules.
- Audit every export request and download.

### Acceptance criteria

- Large exports do not exhaust API/worker memory.
- Export URLs expire.
- Viewer/role restrictions apply to sensitive columns.
- Deleted contacts are absent from newly generated exports.

## P2-004 — Implement retention and deletion

**Status:** `[ ] Pending`  
**Dependencies:** DEC-002, DEC-006, P2-003

### Work

- Define workspace retention settings and defaults.
- Add scheduled purge jobs for raw webhooks, comments, messages, logs, and
  generated exports.
- Create monthly `webhook_events` and `trigger_events` partitions.
- Archive/drop partitions according to retention policy.
- Implement user-initiated contact deletion across all related records.
- Implement workspace deletion with safeguards and audit records.

### Acceptance criteria

- Purge is idempotent and measurable.
- No orphaned PII remains in messages, contacts, event payloads, exports, or
  object storage after deletion.
- Backup/restore behaviour is documented for deletion requests.

## P2-005 — Implement Meta data deletion callback

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P2-004, P0-005

### Work

- Verify Meta signed deletion requests.
- Identify the affected user/contact/account.
- Schedule or perform required deletion.
- Return confirmation code and status URL.
- Provide a status endpoint that does not leak PII.
- Audit the request and completion.

### Acceptance criteria

- Invalid signatures are rejected.
- Deletion is safe to repeat.
- Confirmation status is available to Meta and internal support.

---

# P2 — Billing, usage, notifications, and launch

## P2-006 — Select and integrate payment provider

**Status:** `[ ] Pending`  
**Dependencies:** DEC-005, P0-006

### Work

- Decide Stripe or Razorpay and document the market/tax implications.
- Add configurable plans and limits rather than hard-coding plan logic.
- Store provider/customer/subscription/invoice IDs and statuses only; do not
  store payment card details.
- Add billing overview, hosted checkout, hosted portal, invoices, and usage
  endpoints.
- Verify payment webhook signatures and persist every webhook before processing.
- Make payment processing idempotent.

### Acceptance criteria

- Replayed payment webhooks do not duplicate state changes.
- Provider secrets are never logged or returned.
- Billing state transitions are auditable.

## P2-007 — Implement plans, trials, usage, and enforcement

**Status:** `[ ] Pending`  
**Dependencies:** P1-013, P2-006

### Work

- Implement 14-day trial or confirmed product alternative.
- Configure limits for accounts, DMs, live automations, seats, and features.
- Warn at 80% usage.
- Pause new sends at 100% with `PLAN_LIMIT` while preserving incoming events.
- Add grace period and downgrade behaviour for past-due subscriptions.
- Add add-on DM credits.
- Support audited admin credit grants/plan overrides.

### Acceptance criteria

- Successful DMs increment usage exactly once.
- Cap enforcement works under concurrency.
- Reaching a cap records skipped events instead of dropping events.
- Downgrade never deletes data.

## P2-008 — Add notifications

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P1-004, P2-006

### Work

- Add notification persistence and read/unread state.
- Notify for token invalidation, account reauth, rate delays, plan warnings,
  plan pauses, payment failures, and export completion.
- Add email/provider integration after selecting a provider.
- Use generic messages that do not expose raw Meta/provider errors.

### Acceptance criteria

- Notification delivery is retryable and idempotent.
- Each notification has a stable frontend reason/code.
- Sensitive data is not included in email content or logs.

## P2-009 — Add operations and observability

**Status:** `[ ] Pending`  
**Dependencies:** P0-004, P1-013, P2-006

### Work

- Add structured pino logs with correlation/request/job IDs.
- Add OpenTelemetry traces and Sentry/error tracking.
- Add metrics for webhook receive rate/lag, queue depth/age, comment-to-DM
  latency, send success rate, Meta error class/code, token expiry, and payment
  webhook failure.
- Add alerts for stale webhooks, queue backlog, error spikes, token failures,
  and payment failures.
- Write runbooks for outage, token failures, backlog, duplicate DM reports, and
  policy restrictions.

### Acceptance criteria

- Operators can trace one comment from webhook through match, plan, send, and
  outcome without exposing PII.
- Alerts have thresholds, owners, and runbook links.
- PII/comment text is excluded from analytics/error tracking by default.

## P2-010 — Add deployment and disaster recovery

**Status:** `[ ] Pending`  
**Dependencies:** DEC-002, P0-004, P2-009

### Work

- Create local, staging, and production deployment definitions.
- Give each environment separate Meta app, URL, database, Redis, and keys.
- Add backward-compatible migration deployment steps.
- Add managed Postgres backups and point-in-time recovery.
- Add Redis persistence/failover appropriate to queue requirements.
- Test restore and failover quarterly.
- Add dependency/container scanning in CI.

### Acceptance criteria

- A documented deployment can be executed by someone other than the author.
- Rollback and migration compatibility are tested.
- Restore drills produce a usable service and documented recovery time/data loss.

## P2-011 — Complete staging and launch test plan

**Status:** `[ ] Pending`  
**Dependencies:** P1-003, P1-013, P1-018, P2-009

### Work

- Connect a real Meta staging/test account.
- Verify OAuth, webhook delivery, comments, public reply, private reply, and
  follow-up window behaviour.
- Test duplicate, late, out-of-order, deleted-comment, throttled, expired-token,
  and policy-block scenarios.
- Run k6 webhook load tests at the agreed target volume.
- Test payment webhook replay after billing integration.
- Complete security review and dependency/container scan.

### Acceptance criteria

- All P0/P1 launch scenarios have recorded results.
- No known duplicate-DM or cross-workspace data issue remains open.
- Load results meet the agreed per-account/global targets.
- Launch sign-off names unresolved risks and owners.

---

# V2 backlog

These items are in the specification as V2 or are blocked by the MVP decisions.

- `[ ]` Inbox conversations, messages, SSE stream, human takeover, and resume.
- `[ ]` Teams, invites, expanded membership roles, and agency workspaces.
- `[ ]` Story triggers and direct-message triggers.
- `[ ]` Sequences and scheduled follow-up campaigns.
- `[ ]` Integrations and an integrations outbox/delivery history.
- `[ ]` Reports, planner, and content publishing.
- `[ ]` Advanced insights and content/media insights.
- `[ ]` Admin console, staff auth/SSO/2FA, audit search, and safe impersonation.
- `[ ]` Catch-up tooling beyond the initial reconciliation implementation.

## Definition of done for each task

Every task in this document should meet all applicable conditions before being
marked complete:

1. Code follows strict TypeScript and existing project conventions.
2. Input/output schemas and frontend-safe error codes are documented.
3. Database changes have a forward-compatible migration.
4. The operation is workspace/role scoped where applicable.
5. The operation is idempotent or explicitly documents why it is not.
6. Sensitive tokens and unnecessary PII are not logged or returned.
7. Unit tests cover pure logic and integration tests cover SQL/Redis/provider
   boundaries.
8. Retry, timeout, permanent failure, and dead-letter behaviour are defined.
9. Metrics/audit events exist for operationally important actions.
10. README/local setup and this task list are updated when behaviour changes.

## Immediate next three development tasks

1. **P0-004:** Add `/ready`, Redis readiness checks, dependency timeouts, and
   complete graceful shutdown behavior for the API and worker.
2. **P0-008:** Add PostgreSQL/Redis/Fastify integration tests and CI services,
   including duplicate/concurrent webhook delivery and Redis failure/recovery.
3. **P1-001/P1-002:** Confirm the current Meta API contract and verify OAuth
   account connection using a real staging/test professional account.

## Inputs needed from the project owner

To proceed beyond local infrastructure work, provide or decide:

- Meta app ID, app secret, redirect URI, webhook URL, and staging account.
- Target deployment cloud/region and KMS/object-storage choice.
- Launch market, billing provider, currency, tax requirements, and plan limits.
- Retention duration for comments, messages, raw webhooks, logs, and exports.
- Expected comments/DMs per second and per-account rate targets.
- Whether teams/agencies and Inbox are MVP or V2.
