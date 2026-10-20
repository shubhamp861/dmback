# Backend Scripts Guide

This folder contains the project setup, startup, database, smoke-test, and
integration-verification scripts. The project target is **Windows with Docker
Desktop**. Run Windows PowerShell scripts from the `node_code` directory unless
the command below says otherwise.

## Quick command reference

| Goal | Command |
| --- | --- |
| First-time Windows setup | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-windows.ps1` |
| Start development API/worker | `npm run dev:windows` |
| Start/check the P0 stack | `npm run dev:p0:windows` |
| Run Windows integration verification | `npm run test:integration:windows` |
| Validate native PostgreSQL/Memurai and run all checks | `npm run validate:native:windows` |
| Apply database migrations | `npm run db:migrate` |
| Check migration status | `npm run db:migrate:status` |
| Seed local development data | `npm run db:seed` |
| Send a signed local webhook | `npm run webhook:smoke` |

## Windows scripts

### `bootstrap-windows.ps1`

First-time Windows prerequisite and project setup. It checks or installs the
required local tooling, prepares the project environment, starts the required
Docker Desktop development services, installs dependencies when needed, applies
migrations, and reports the resulting status. It preserves an existing `.env`.

Use it when setting up the project on a new Windows machine:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-windows.ps1
```

### `start-dev-windows.ps1`

Starts the normal Windows development stack using Docker Desktop, including
PostgreSQL and Redis, then starts the API and worker. It also performs the
normal development database setup unless `-SkipDbSetup` is supplied.

```cmd
npm run dev:windows
npm run dev:windows -- -SkipDbSetup
```

### `start-p0-windows.ps1`

Starts the P0 development stack and performs the P0 checks. It is useful when
you want one command to start the API/worker, verify health/readiness, apply
migrations, and optionally run tests.

```cmd
npm run dev:p0:windows
npm run dev:p0:windows -- -RunTests
npm run dev:p0:windows -- -SkipDbSetup
```

### `test-integration-windows.ps1`

Runs the complete disposable Windows integration verification flow:

1. Removes leftover integration containers.
2. Starts the separate PostgreSQL and Redis test containers.
3. Runs the real PostgreSQL/Redis/Fastify/BullMQ integration suite.
4. Stops the test containers, including when the test suite fails.

Recommended command:

```cmd
npm run test:integration:windows
```

The default disposable PostgreSQL host port is `15432`; Redis uses `56379`.
If Windows reserves the PostgreSQL port, select another port and pass it to the
script:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-integration-windows.ps1 -PostgresPort 15433
```

The script sets `TEST_POSTGRES_PORT` for the child commands so Docker Compose
and the integration test connection use the same port.

### `validate-native-windows.ps1`

Validates the Docker-free native Windows setup. It checks `pg_isready`, `psql`,
Memurai/Redis `PING`, Redis read/write, logical database `/15`, Lua support,
PostgreSQL `pgcrypto`, and the ability to create/drop a temporary schema. It
then applies/checks development migrations and runs typecheck, build, unit
tests, and the real integration suite.

Set the dedicated integration URLs before running it:

```cmd
set TEST_DATABASE_URL=postgres://integration:YOUR_PASSWORD@127.0.0.1:5432/instagram_automation_test
set TEST_REDIS_URL=redis://127.0.0.1:6379/15
npm run validate:native:windows
```

Use `-SkipProjectChecks` when you only want service, permission, Redis, schema,
and Lua validation:

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate-native-windows.ps1 -SkipProjectChecks
```

## Database and local smoke-test scripts

### `migrate.ts`

Applies pending PostgreSQL migrations from `migrations/` using `DATABASE_URL`.
It takes an advisory lock, creates the migration tracking table, verifies
checksums, and applies migrations in order.

```cmd
npm run db:migrate
```

Run this against the development database only after confirming `.env` points
to the intended local database. Do not point it at the disposable integration
database; the integration suite manages its own schema.

### `migration-status.ts`

Reports whether each migration is applied, pending, modified, or missing. It
uses `DATABASE_URL` and does not apply migrations.

```cmd
npm run db:migrate:status
```

### `migration-utils.ts`

Shared migration loading, checksum, ordering, and migration-status logic used by
`migrate.ts`, `migration-status.ts`, and the integration test setup. It is a
library module, not a direct command.

### `seed.ts`

Creates or updates deterministic local development data: a workspace, owner
user, Instagram account, and sample automation. It uses `DATABASE_URL` and is
intended for local development only.

```cmd
npm run db:seed
```

The local development password is defined by the script for the seeded account;
do not use seeded credentials in staging or production.

### `send-local-webhook.ts`

Sends a signed sample Instagram comment webhook to the locally running API. It
uses `META_APP_SECRET` and `PORT` from `.env` and is intended for local smoke
testing after the API, worker, migrations, seed data, and Docker services are
running.

```cmd
npm run webhook:smoke
```

It verifies the webhook signature and queue/outbox path; it does not send a real
Instagram message.

## Shell scripts

### `bootstrap.sh`

Legacy/native Ubuntu or WSL bootstrap script. It installs and configures native
Linux prerequisites and is **not part of the Windows-only development flow**.
Do not run it for the Windows Docker setup.

### `start-dev.sh`

Legacy/native Ubuntu or WSL development launcher. It starts native or selected
Linux infrastructure, performs database setup, and starts the backend. Use
`start-dev-windows.ps1` instead for this project’s Windows target.

## Safety notes

- Do not run database migration or seed commands without checking `DATABASE_URL`.
- Do not use the integration database for development data.
- Integration containers use disposable storage and separate ports from the
  development Compose stack.
- Do not commit `.env`, credentials, API keys, or generated local data.
- Do not install Linux services or WSL dependencies for the Windows workflow.
