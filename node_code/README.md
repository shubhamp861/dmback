## Instagram automation backend

This repository contains the first backend foundation for the Instagram comment-to-DM
automation service described in `devResource/Backend-Specification-Instagram-Automation-Tool.pdf`.

### Included foundation

- Fastify + strict TypeScript service with health and automation endpoints.
- PostgreSQL migration for workspaces, Instagram accounts, automations, contacts,
  webhook events, partition-ready trigger events, messages, usage, and audit records.
- Redis/BullMQ queue boundary for asynchronous webhook matching.
- Transactional webhook outbox with worker retry when Redis dispatch fails.
- HMAC-SHA256 Instagram webhook verification using the raw request body.
- Duplicate webhook protection using a payload hash and idempotent trigger keys.
- Keyword matching for contains, exact, starts-with, regex, punctuation normalization,
  exclusions, and stored reason codes.
- Unit tests for signature verification and matching behaviour.

### Local setup overview

Windows is the supported development environment. Everything runs natively:
PostgreSQL, Redis/Memurai, the backend API, the BullMQ worker, and the Vite
frontend. There are no containers.

Run backend commands from:

```powershell
Set-Location C:\Drive-D\dmlinkProject\node_code
```

Run frontend commands from:

```powershell
Set-Location C:\Drive-D\dmlinkProject\react-code
```

The API and worker are separate processes. PostgreSQL is the database, Redis is
the BullMQ queue backend, and the API does not start the worker automatically.

### Quick start with batch files

From the repository root, the batch files in `scripts\windows\` wrap the
PowerShell launchers:

| Command | Purpose |
| --- | --- |
| `scripts\windows\firstboot.bat` | One-time setup and start (prerequisites, dependencies, migrations, seed). |
| `scripts\windows\run.bat` | Daily start; skips processes that are already running. |
| `scripts\windows\stop.bat` | Stop API, worker, and frontend; leaves PostgreSQL and Memurai running. |

Append `/nopause` for non-interactive use. Use
`powershell -File scripts\windows\stop.ps1 -IncludeServices` to stop the
PostgreSQL and Memurai services as well.

## Initial boot: Windows

For native Windows development, install or update **App Installer** from the
Microsoft Store so that `winget` is available. Then open PowerShell and run the
Windows onboarding script from the `node_code` directory:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\bootstrap-windows.ps1
```

The Windows script installs or verifies Git, Python 3, Node.js LTS/npm with
`winget`, creates a local `.env` only when one does not already exist,
runs `npm ci`, waits for the native PostgreSQL and Redis/Memurai services,
applies migrations, inserts seed data, and runs typecheck, tests, and the build.

It is safe to rerun and preserves an existing `.env`. If PowerShell still cannot
find a tool immediately after `winget` installs it, close and reopen PowerShell
and rerun the script. PostgreSQL and Redis/Memurai must already be installed as
Windows services.

The script is:

```text
scripts/bootstrap-windows.ps1
```

After onboarding, use the Windows-specific development command to verify the
native PostgreSQL and Redis services, apply local database setup, and run the
API:

```powershell
npm run dev:windows
```

The API stays in the foreground. Use `npm run dev:worker` in a second
PowerShell window for the worker. If migrations and seed data are already
current, skip that step with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-windows.ps1 -SkipDbSetup
```

### Manual PostgreSQL setup

PostgreSQL and Redis/Memurai must be installed and running as native Windows
services. Start them from an elevated PowerShell when they are stopped; the
exact PostgreSQL service name depends on the installed version:

```powershell
Get-Service *postgres*
Get-Service *memurai*
Start-Service postgresql-x64-18
Start-Service Memurai
```

The expected local development database is:

```text
PostgreSQL role: instagram
PostgreSQL password: instagram
Database: instagram_automation
```

Create it once with the `psql` client that ships with PostgreSQL. Replace
`postgres` if your installation uses a different superuser role:

```powershell
psql -U postgres -h 127.0.0.1 -c "CREATE ROLE instagram LOGIN PASSWORD 'instagram';"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE instagram_automation OWNER instagram;"
```

If the role or database already exists, repair it instead of recreating it:

```powershell
psql -U postgres -h 127.0.0.1 -c "ALTER ROLE instagram WITH LOGIN PASSWORD 'instagram';"
```

Verify the connection:

```powershell
$env:PGPASSWORD = 'instagram'
psql -h 127.0.0.1 -U instagram -d instagram_automation -c "SELECT current_user, current_database();"
Remove-Item Env:PGPASSWORD
```

### Configure and initialize the backend

With PostgreSQL and Redis/Memurai running, from `node_code/`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run db:migrate
npm run db:migrate:status
npm run db:seed
```

Edit `.env` if your PostgreSQL or Redis credentials/ports differ from the
defaults in `.env.example`; do not overwrite an existing `.env` because it holds
local secrets. The services must already be listening on
`127.0.0.1:5432` and `127.0.0.1:6379`; these steps do not start the API or
worker.

Migration files are discovered from `migrations/` in numeric filename order. The
runner records each applied file and its SHA-256 checksum in `schema_migrations`,
runs each new migration in its own transaction, and refuses to continue if an
applied file is changed or removed. Inspect the current state with:

```bash
npm run db:migrate:status
```

## Insert local test data

The seed command is repeatable and safe to run more than once:

```bash
npm run db:seed
```

It creates or updates these development records:

| Record | ID/value |
| --- | --- |
| Workspace | `11111111-1111-4111-8111-111111111111` |
| User | `developer@example.local` |
| Instagram account | `33333333-3333-4333-8333-333333333333` |
| Automation | `44444444-4444-4444-8444-444444444444` |
| Keyword | `guide` |

The local development login is:

```text
email: developer@example.local
password: local-development-password
```

These credentials and generated local secrets are for development only.

## Start the app for local testing

### Run the stack manually

PostgreSQL and Redis/Memurai must already be running. Open three terminals from
the repository root.

Terminal 1 - backend API:

```powershell
Set-Location C:\Drive-D\dmlinkProject\node_code
npm run dev
```

Terminal 2 - BullMQ worker (required for webhook matching):

```powershell
Set-Location C:\Drive-D\dmlinkProject\node_code
npm run dev:worker
```

Terminal 3 - frontend:

```powershell
Set-Location C:\Drive-D\dmlinkProject\react-code
npm ci
npm run dev
```

The API listens on `http://localhost:3000`, the worker uses the same PostgreSQL
and Redis services, and Vite serves the frontend on
`http://localhost:3001`. Open the frontend at that exact origin: the backend
`WEB_ORIGIN` defaults to `http://localhost:3001`, and mixing `localhost` with
`127.0.0.1` breaks browser cookies and CORS. Run `npm ci` in `react-code/` only
the first time.

### Optional Windows shortcuts

The PowerShell scripts wrap the native service checks, database setup, API, and
worker:

```powershell
npm run dev:windows
```

For the complete P0 development startup—including service checks, migrations,
seed data, API, worker, and readiness verification—use the single Windows
command:

```powershell
npm run dev:p0:windows
```

The script starts the native Windows services when they are stopped (which may
require an elevated PowerShell), then waits for PostgreSQL on `127.0.0.1:5432`
and Redis on `127.0.0.1:6379`. If a service is not installed, start it manually
and rerun the command.

This starts the API and worker in separate PowerShell windows. It does not run
the full test suite by default. To also run typecheck, unit tests, and build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-p0-windows.ps1 -RunTests
```

If migrations and seed data are already current:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-p0-windows.ps1 -SkipDbSetup
```

The API remains in the foreground. To skip migrations and seed data:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-windows.ps1 -SkipDbSetup
```

The worker is a separate process. Start it in a second terminal so accepted
webhook events are matched:

```powershell
npm run dev:worker
```

The API listens on `http://127.0.0.1:3000`. Verify the local services with:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
Test-NetConnection -ComputerName 127.0.0.1 -Port 6379
Invoke-WebRequest http://127.0.0.1:3000/health
```

Expected Redis output is `PONG`. `/health` is dependency-independent liveness:

```json
{"status":"ok"}
```

`/live` is an additional liveness alias. Use `/ready` to check both PostgreSQL
and Redis; it returns HTTP 200 only when both respond, otherwise HTTP 503:

```powershell
curl.exe http://127.0.0.1:3000/ready
```

```json
{"status":"ok","dependencies":{"database":"ok","queue":"ok"}}
```

Failed checks report `unavailable` or `timeout` without exposing connection
details. Optional `.env` settings `READINESS_TIMEOUT_MS` (default 2000) and
`SHUTDOWN_TIMEOUT_MS` (default 30000) control check and shutdown deadlines.
Database connections and queries also have finite timeouts. A successful
`/health` response alone does not mean the application is ready for traffic.

On Ctrl-C/SIGINT or SIGTERM, the API drains requests and closes Redis/database
connections. The worker stops taking jobs and polling, drains its in-flight poll
and jobs, then closes dependencies. Shutdown is idempotent and deadline-bounded;
deadline expiry exits nonzero, leaving unfinished jobs for BullMQ stalled-job
and outbox-lease recovery. Live process-restart/outage tests are still pending.

### Workspace role policy

| Operation | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Read workspace accounts, automations, events | Yes | Yes | Yes | Yes |
| Connect Instagram (start and callback) | Yes | Yes | No | No |
| Replay a stored workspace webhook | Yes | Yes | No | No |
| Create/publish/pause/resume automations | Yes | Yes | Yes | No |

Unknown roles are denied. Mutations still require session authentication and
valid CSRF tokens. Current resource queries remain scoped to the authenticated
workspace. Replay requests now have audit records; broader audit logging and
membership management remain pending. SQL isolation
tests are implemented in the dedicated integration suite; the user reported
successful Windows testing, but no exact run output was captured here.

### Audited webhook replay by event ID

After updating, stop the API/worker, run `npm run db:migrate` from Windows, then
restart both. Migration `002_webhook_replays.sql` adds replay request storage;
do not edit or reapply `001_initial.sql` manually.

```text
POST /v1/webhook-events/:id/replay
```

Requires an Owner/Admin session, the readable CSRF cookie, and its matching
`x-csrf-token` header. No body is needed; extra body fields are rejected. The
workspace and actor are taken only from the session. Example browser call:

```ts
await fetch(`${API_BASE_URL}/v1/webhook-events/${eventId}/replay`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'x-csrf-token': csrfToken }
});
```

HTTP 202 means the audit record and durable replay request have committed:

```json
{"data":{"id":"<replay-request-uuid>","webhookEventId":"<event-uuid>","status":"pending"}}
```

This is **not** a completion receipt. The worker polls replay requests alongside
the original outbox (normally every five seconds after a poll finishes). Redis
can be unavailable at acceptance: failed dispatch is persisted and retried.
The normal worker must run for dispatch/processing to happen.

- 400: invalid event UUID or unsupported body fields.
- 401: missing/expired session.
- 403: forbidden role or invalid CSRF.
- 404: missing, foreign, mixed-workspace, malformed, or unsupported event.
  The response intentionally does not distinguish these cases.
- 500: persistence failure; no accepted replay is reported.

Replay is limited to stored `instagram` payloads with supported comment events.
Every entry account must exist and belong to the workspace. A multi-workspace
or unknown-account batch is rejected in full, not partially replayed. Membership
and ownership are rechecked transactionally; ownership is checked again before
processing, and trigger writes are workspace-checked under their transaction.

Every accepted request creates an immutable `audit_log` record with action
`webhook.replay.requested`, actor, workspace, event UUID, timestamp, and only a
`replayId` in metadata. The `webhook_replays` table stores independent dispatch
and processing states/attempts, and links to the audit row. Audit failure rolls
back the request. There is no new audit-list/replay-status endpoint yet; these
records are currently available to database operators only.

Each accepted call creates a new replay UUID and BullMQ job `replay-<uuid>`;
therefore a retained original completed/failed job cannot swallow the retry.
Repeated/concurrent calls are independently audited, not coalesced. Dispatch
retries reuse the same replay job ID. Existing trigger idempotency keys are
never deleted or reset, so a previously recorded trigger remains unchanged.
Already-processed replay deliveries are no-ops. Exhausted processing attempts
require a new replay request; this is matching recovery, not message resend.
Replay uses current live automation rules, not an immutable historical snapshot.

This version intentionally has no bulk/time-range replay, rate limiting,
operator dashboard, or message-send replay. The replay table's foreign keys
must be considered when implementing future retention/deletion policies.

### Configuration and secret hardening

Development/test defaults remain usable. In **staging and production**, startup
requires explicit `DATABASE_URL`, `REDIS_URL`, `META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`, `META_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`,
`TOKEN_ENCRYPTION_KEY`, and `WEB_ORIGIN`. Recognized development/default and
placeholder values are rejected. Meta app secrets and webhook verification
tokens must contain at least 32 characters. Cookies use `Secure` in both modes.

All modes require a PostgreSQL URL (`postgres:`/`postgresql:`), a Redis URL
(`redis:`/`rediss:`), and a canonical, padded base64 encryption key decoding to
exactly 32 bytes. Staging/production additionally reject the default key and
repeated-byte/recognized placeholder material. Configuration errors contain
field names and fixed reasons, never supplied values. The production template
is `.env.production.example`; it intentionally fails validation until replaced
with real, private configuration. Do not copy credentials into chat or Git.

On Windows, generate new **local** key material privately in your terminal with:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Never overwrite an existing encryption key merely to resolve validation errors:
existing Instagram tokens require their original key to decrypt. KMS-backed
envelope encryption, key versions, rotation and audit are still required before
production rollout; no migration/rotation mechanism is implemented here.

Staging/production callback URLs, web origins, and Meta endpoint bases require
HTTPS without embedded credentials or recognized development hosts. `WEB_ORIGIN`
must be an origin, not a URL with path/query/fragment. Database TLS and Redis TLS
remain deployment-controlled (internal networking may terminate TLS); configure
provider-appropriate certificate validation. URL validation is not an outbound
destination allowlist, DNS firewall, or guarantee of secret entropy.

Runtime logging now uses allowlisted error names/codes and route templates,
omitting raw messages/stacks/causes, request query strings, payloads and headers.
Automatic request logs are disabled, and Pino structured-key redaction adds a
second layer. Request IDs are generated locally instead of trusting arbitrary
`x-request-id` values. Generic HTTP errors and OAuth failures use fixed messages.
New outbox dispatch failures store `QUEUE_DISPATCH_FAILED`; matching-job failures
hand BullMQ a sanitized error before its diagnostic persistence. Existing stored
errors are not rewritten. Avoid free-form sensitive log strings in future code;
redaction is not a universal scanner for arbitrary nested/string content.

### P0 API request contract

JSON errors include `code`, `message`, and a generated `requestId`; validation
errors also include `fields`. Stable request/parser errors are `INVALID_JSON`
(400), `INVALID_CONTENT_TYPE` (415), and `PAYLOAD_TOO_LARGE` (413). The signed
webhook keeps its raw-body path and the webhook challenge remains plain text.

Authenticated state-changing POSTs accept an optional `Idempotency-Key`. Keys
must contain 1–128 printable ASCII characters without whitespace. Automation
create/status and webhook replay currently support it. A repeated key for the
same workspace/user and request fingerprint replays the stored status/body
without running the mutation again. A different or in-progress request returns
409; invalid keys return 400. Handler failures abandon the in-progress record.
Apply migration `003_idempotency_keys.sql` before using this behavior. Do not
put secrets in response bodies because completed responses are persisted for
replay. Cursor pagination, retention cleanup, and OpenAPI generation remain
pending.

Redis-backed rate limits apply to authenticated routes and use independent
user/workspace buckets. Authentication endpoints use an IP bucket, while signed
Instagram deliveries use a webhook IP bucket. Limited requests return HTTP 429
with `RATE_LIMITED`, `RateLimit-Limit`, `RateLimit-Remaining`, and
`Retry-After`. The default 60-second limits are 20 auth-IP requests, 120
webhook-IP requests, 120 user requests, and 300 workspace requests. Configure
them with `RATE_LIMIT_*` environment variables. Limiter Redis failures fail
open so webhook persistence remains durable during Redis outages.

### Cursor pagination

The list endpoints support opaque keyset cursors:

```text
GET /v1/ig-accounts?limit=50&cursor=<opaque-cursor>
GET /v1/automations?limit=50&cursor=<opaque-cursor>
GET /v1/automations/:id/events?limit=50&cursor=<opaque-cursor>
```

`limit` defaults to 50 and accepts values from 1 through 100. Results are
ordered by `created_at DESC, id DESC` and the response includes:

```json
{
  "data": [],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

Cursors are bound to their resource and workspace/automation scope. Invalid,
cross-resource, or cross-scope cursors return `400 INVALID_CURSOR`. Pagination
uses keyset queries rather than offset scans, so inserts before the current
cursor do not shift later pages.

## Local API testing

Use a cookie file outside the repository so session and CSRF cookies are not
accidentally committed. Login and inspect the current authenticated user:

```bash
COOKIE_JAR=/tmp/dmlinl-api-cookies
rm -f "${COOKIE_JAR}"

curl --fail-with-body -c "${COOKIE_JAR}" -X POST \
  http://127.0.0.1:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"developer@example.local","password":"local-development-password"}'

curl --fail-with-body -b "${COOKIE_JAR}" \
  http://127.0.0.1:3000/v1/auth/me
```

Authenticated GET requests use the session cookie. State-changing automation
requests also need the CSRF cookie value in the `x-csrf-token` header:

```bash
CSRF_TOKEN=$(awk '$6 == "csrf_token" {print $7}' "${COOKIE_JAR}")

curl --fail-with-body -b "${COOKIE_JAR}" \
  http://127.0.0.1:3000/v1/ig-accounts

curl --fail-with-body -b "${COOKIE_JAR}" \
  http://127.0.0.1:3000/v1/automations

curl --fail-with-body -b "${COOKIE_JAR}" -X POST \
  http://127.0.0.1:3000/v1/automations/44444444-4444-4444-8444-444444444444/pause \
  -H "x-csrf-token: ${CSRF_TOKEN}"
```

After starting both the API and worker, send a signed local comment event:

```bash
npm run webhook:smoke
```

Inspect the worker result:

```bash
curl --fail-with-body -b "${COOKIE_JAR}" \
  http://127.0.0.1:3000/v1/automations/44444444-4444-4444-8444-444444444444/events
```

The response should contain a `queued` result with the matched keyword `guide`.
Sending the same webhook again should not create a second trigger event. The
current foundation records the match only; it does not send a real Instagram DM.

## Local project checks

Run these checks from the `node_code` directory:

```bash
npm run typecheck
npm test
npm run build
```

The current tests cover authentication, automation rules, keyword matching,
migrations, OAuth URL behavior, webhook signatures, and token encryption.

### Isolated PostgreSQL/Redis integration tests (Windows)

With native PostgreSQL and Redis/Memurai running, from `C:\Drive-D\dmlinkProject\node_code`:

```cmd
npm run test:integration
```

The same sequence with the test environment prepared automatically is
available as:

```cmd
npm run test:integration:windows
```

That script derives `TEST_DATABASE_URL` from `DATABASE_URL` in `.env` by
swapping only the database name for the dedicated `*_test` database, and sets
`TEST_REDIS_URL` to `redis://127.0.0.1:6379/15`. No credentials are written to
the repository. Override either value explicitly when needed:

```cmd
set TEST_DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/instagram_automation_test
set TEST_REDIS_URL=redis://127.0.0.1:6379/15
npm run test:integration
```

The suite runs against a dedicated database ending in `_test` and Redis logical
database `/15`, never the development database. The API and normal worker do
not need to be stopped.

The integration suite uses real SQL, Fastify HTTP injection and a real BullMQ
worker to check:

- Invalid webhook signatures produce no persisted event.
- Concurrent duplicate deliveries produce one webhook/outbox and one match.
- Distinct, out-of-order deliveries of the same comment retain one trigger.
- Dropping the producer's Redis TCP connection preserves the event/outbox;
  restoring the connection allows outbox dispatch and processing.
- Concurrent outbox claims and stale lease recovery.
- Cross-workspace SQL isolation and current membership role enforcement.
- Failure of the outbox insert rolls back the associated webhook transaction.

Tests never use `DATABASE_URL` or `REDIS_URL` as test targets. To use separately
provisioned test services, supply `TEST_DATABASE_URL` (database name must end
in `_test`) and `TEST_REDIS_URL` (Redis database `/15`). The test user needs
permission to create/drop schemas and create `pgcrypto` in that test database.
Every run gets a random SQL schema and BullMQ prefix; cleanup drops only that
schema and queue namespace. There is no `FLUSHDB` or developer-data truncation.
If the process is force-killed, leftover test namespaces may remain in the
test database until they are dropped manually.

`npm test` runs unit/HTTP-double tests only. `npm run test:integration` is a
separate required check and fails, rather than silently passing, when test
services are missing. CI runs `npm ci`, typecheck, unit tests, and build; run
the integration suite locally.
The integration suite simulates a transport failure, not a real Redis server
restart, disk loss, or an OS-signal shutdown with active jobs; those checks are
still pending.

The latest automation-environment check passed 293 unit/HTTP-double tests,
typecheck, and build. The user reported successful Windows integration testing
after reinstalling Windows dependencies. No exact run output or CI receipt was
captured, and the latest security changes have not been rerun against live
Windows test services here. The expanded suite now contains 14 integration
cases, including replay/audit/recovery coverage; these remain blocked here by
test PostgreSQL connection refusal. Use the commands above to reverify them.

HTTP test files initialize Fastify's lazy injection engine in a bounded setup
hook, rather than charging cold shared-filesystem module loading to the first
permission/CSRF assertion. Endpoint test timeouts are unchanged; no retries or
skipped assertions were introduced to hide failures.

## Instagram account connection

The first OAuth/account-connection flow is available at:

- `GET /v1/auth/instagram/start`
- `GET /v1/auth/instagram/callback`
- `GET /v1/ig-accounts`

The start route requires a logged-in session and creates a single-use,
session-bound OAuth state. Configure real Meta credentials before using it:

```dotenv
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_REDIRECT_URI=http://localhost:3000/v1/auth/instagram/callback
META_API_VERSION=v23.0
META_GRAPH_BASE_URL=https://graph.instagram.com
META_OAUTH_BASE_URL=https://api.instagram.com
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
TOKEN_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

The current contract assumptions and items still requiring confirmation in the
Meta dashboard/documentation are recorded in
`devResource/META-INTEGRATION-CONTRACT.md`. Local AES-GCM token encryption is
implemented for development; production must use KMS-backed envelope encryption.

## Current API examples

Create a draft automation:

```bash
curl -X POST http://localhost:3000/v1/automations \
  -b "${COOKIE_JAR}" \
  -H 'content-type: application/json' \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -d '{
    "name": "Send the guide",
    "igAccountId": "33333333-3333-4333-8333-333333333333",
    "keywordRules": [{"value": "guide", "mode": "contains"}],
    "publicReplies": ["Check your DMs"]
  }'
```

Before production use, the remaining specification work includes Meta contract
verification, KMS token encryption, token refresh, account subscriptions,
worker-side sending, flow execution, billing, analytics, retention, and the
complete authenticated API surface. Meta endpoint and permission names should be
verified against the current Meta documentation before those integrations are
enabled.
