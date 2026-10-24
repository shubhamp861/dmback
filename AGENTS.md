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
- CI runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`; verify the working directory when changing CI because the package is nested under `node_code/`.

## Integration services

- Integration tests must use a dedicated PostgreSQL database whose name ends in `_test` and Redis logical database `/15`; never use the development database or Redis database.
- Set `TEST_DATABASE_URL` and `TEST_REDIS_URL` explicitly for native services, for example PostgreSQL on `127.0.0.1:5432` and Redis/Memurai on `127.0.0.1:6379`.
- `npm run validate:native:windows` checks native PostgreSQL/Memurai, applies development migrations, then runs typecheck, build, unit tests, and integration tests.
- `npm run test:integration:windows` runs the suite against the native services; it derives the dedicated `*_test` database URL from `DATABASE_URL` in `.env` and uses Redis logical database `/15`.
- Running bare `npm run test:integration` without services or test URLs commonly fails during setup with `ECONNREFUSED`; that means the integration environment was unavailable, not that assertions passed.

## Database and migrations

- `npm run db:migrate` and `npm run db:migrate:status` use `DATABASE_URL` loaded from `.env`; inspect the target before running either command.
- Migration files in `migrations/` are discovered in numeric filename order, run transactionally, and recorded with checksums. Add a new numbered migration; do not edit or remove an applied migration.
- The integration harness creates a random schema and applies every migration itself. Do not point development migration or seed commands at the integration database.
- Use `npm run db:seed` only for local development data. Use `npm run webhook:smoke` only after the API, worker, database, Redis, migrations, and seed data are running.

## Windows workflow and safety

- Windows is the supported checkout environment. PostgreSQL and Redis/Memurai run as native Windows services.
- Start development with `npm run dev:windows` or the full P0 launcher `npm run dev:p0:windows`; start the worker separately with `npm run dev:worker` when using the plain API command.
- Do not read, print, commit, or copy `.env` secrets, database passwords, API keys, or tokens. Use `.env.example` and `.env.production.example` as templates.
- Do not reinstall or replace the existing Windows dependencies from automation. Keep generated `dist/`, `coverage/`, logs, and `.env*` ignored by `node_code/.gitignore`.
- Root `.gitignore` ignores workspace-private agent attachments under `.opencode/omnirush/inbox/`; do not add those generated files to commits.

## Source-of-truth notes

- Prefer package scripts, CI, and PowerShell validation scripts over stale prose when they disagree.
- Read `node_code/PROJECT_CONTEXT.md` for current implementation status and `node_code/devResource/BACKEND-PENDING-TASKS.md` for the backlog; confirm both against source and tests before claiming work is complete.

## Frontend package

- `react-code/` is a separate Vite + React 19 + TypeScript frontend; it is not Next.js and the backend does not use Prisma as its database source of truth.
- Run frontend commands from `react-code/`: `npm run lint`, `npm run build`, and `npm run dev`.
- The frontend dev server is configured for `http://127.0.0.1:3001`; the backend API is normally `http://127.0.0.1:3000`. Set `VITE_API_BASE_URL` in the frontend environment when the API origin differs.
- Frontend API calls use cookie sessions with `credentials: 'include'`; never store the HttpOnly `session` cookie in browser storage, and send the readable `csrf_token` cookie as `x-csrf-token` for mutations.
- Keep `react-code/src/lib/api.ts` aligned with `node_code/share/API-AUTH-MAPPING.md`; the mapping documents implemented API behavior, not future product screens.

## Email signup authentication

- Registration is a three-step backend flow: `POST /v1/auth/signup/request-otp`, `POST /v1/auth/signup/verify-otp`, then `POST /v1/auth/signup/complete`.
- OTPs are hashed, six digits, valid for 10 minutes, limited to 5 attempts, and resend-cooldown protected; do not log or return raw OTPs or verification tokens except through their defined response.
- Migration `005_email_verification.sql` adds email verification state; add later migrations rather than editing applied migration files.
- The current email provider is `FakeEmailProvider` for development/tests and does not deliver real email; do not claim email delivery works until a provider is implemented and configured.
- Preserve the existing password login/session flow while changing signup; email authentication and Instagram OAuth are separate concerns.

## Local full-stack smoke setup

- Use the same host spelling for both browser and API (`127.0.0.1` or `localhost`); cookies for those hosts are not interchangeable, and backend `WEB_ORIGIN` must exactly match the frontend origin.
- Start the backend API and worker separately when using plain development commands, then start the Vite frontend on port 3001; a frontend HTTP 200 only proves the Vite server responded, not that auth/database integration works.
- Apply development migrations with `npm run db:migrate` before testing the OTP flow against a real database; never use the dedicated integration database for development data.

## Production serving

- The repository has no container configuration. Production serving uses Fastify plus `@fastify/static`; `/v1/*`, `/health`, `/live`, and `/ready` remain backend routes, while browser `GET`/`HEAD` navigations fall back to the built `index.html`.
- Same-origin production should leave `VITE_API_BASE_URL` empty at frontend build time; the browser then calls the existing `/v1` API paths on the served origin.

## Single-command local startup

- From the repository root, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-windows.ps1` creates `node_code/.env` if missing, installs both locked dependency graphs, waits for the native PostgreSQL/Redis services, runs the P0 API/worker startup, and starts the Vite frontend on port 3001.
- Use `-SkipInstall` for an already-installed checkout, `-SkipDbSetup` when migrations/seed data are current, and `-RunTests` to run backend typecheck/unit/build checks after startup.

## Windows batch shortcuts

- `scripts\windows\firstboot.bat` performs first-time setup: prerequisite checks, `.env` creation when missing, backend and frontend dependency installation, migrations/seed, and startup.
- `scripts\windows\run.bat` is the daily start; it assumes `.env`, dependencies, migrations, and seed data are already in place and skips API, worker, and frontend processes that are already running.
- `scripts\windows\stop.bat` stops the API, worker, and frontend, leaving PostgreSQL and Memurai running. Use `powershell -File scripts\windows\stop.ps1 -IncludeServices` to stop those services too.
- Append `/nopause` to a batch file for non-interactive use.
