# AGENTS.md

## Repository shape

- The active application package is `node_code/`; the repository root has no `package.json`.
- Run all npm, TypeScript, migration, and Vitest commands from `node_code/`.
- The backend entrypoints are `src/server.ts` (Fastify API) and `src/worker.ts` (BullMQ worker); they are separate processes.
- `src/app.ts` wires routes, health checks, PostgreSQL, Redis/BullMQ, auth, and the Redis-backed rate limiter.

## Required checks

- Install the locked dependency graph with `npm ci` from `node_code/`.
- Run the normal local gate in this order: `npm run typecheck`, `npm test`, `npm run build`.
- Run one focused test with `node node_modules/vitest/vitest.mjs run tests/<name>.test.ts`.
- The integration suite is `npm run test:integration`; it uses `vitest.integration.config.ts`, one worker, and serial files with 30-second test/hook timeouts.
- CI runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:integration`; verify the working directory when changing CI because the package is nested under `node_code/`.

## Integration services

- Integration tests must use a dedicated PostgreSQL database whose name ends in `_test` and Redis logical database `/15`; never use the development database or Redis database.
- Set `TEST_DATABASE_URL` and `TEST_REDIS_URL` explicitly for native services, for example PostgreSQL on `127.0.0.1:5432` and Redis/Memurai on `127.0.0.1:6379`.
- `npm run validate:native:windows` checks native PostgreSQL/Memurai, applies development migrations, then runs typecheck, build, unit tests, and integration tests.
- `npm run test:integration:windows` is the disposable Docker path; it uses PostgreSQL port `15432` and Redis port `56379` by default, and cleans up containers afterward.
- Running bare `npm run test:integration` without services or test URLs commonly fails during setup with `ECONNREFUSED`; that means the integration environment was unavailable, not that assertions passed.

## Database and migrations

- `npm run db:migrate` and `npm run db:migrate:status` use `DATABASE_URL` loaded from `.env`; inspect the target before running either command.
- Migration files in `migrations/` are discovered in numeric filename order, run transactionally, and recorded with checksums. Add a new numbered migration; do not edit or remove an applied migration.
- The integration harness creates a random schema and applies every migration itself. Do not point development migration or seed commands at the integration database.
- Use `npm run db:seed` only for local development data. Use `npm run webhook:smoke` only after the API, worker, database, Redis, migrations, and seed data are running.

## Windows workflow and safety

- Windows is the supported checkout environment. Prefer the native validation script when PostgreSQL/Memurai are already installed; Docker remains available through the disposable integration wrapper.
- Start development with `npm run dev:windows` or the full P0 launcher `npm run dev:p0:windows`; start the worker separately with `npm run dev:worker` when using the plain API command.
- Do not read, print, commit, or copy `.env` secrets, database passwords, API keys, or tokens. Use `.env.example` and `.env.production.example` as templates.
- Do not reinstall or replace the existing Windows dependencies from automation. Keep generated `dist/`, `coverage/`, logs, `.env*`, and Docker data ignored by `node_code/.gitignore`.
- Root `.gitignore` ignores workspace-private agent attachments under `.opencode/omnirush/inbox/`; do not add those generated files to commits.

## Source-of-truth notes

- Prefer package scripts, CI, and PowerShell validation scripts over stale prose when they disagree.
- Read `node_code/PROJECT_CONTEXT.md` for current implementation status and `node_code/devResource/BACKEND-PENDING-TASKS.md` for the backlog; confirm both against source and tests before claiming work is complete.
