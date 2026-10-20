# Backend installation prerequisites

This guide prepares a Windows development machine for the Instagram automation
backend. WSL-native PostgreSQL and Redis are not supported for this checkout.

The backend uses:

- Node.js 20 or newer and npm
- Python 3, pip, and a virtual-environment tool for supporting scripts
- PostgreSQL 16 (PostgreSQL 15+ works for local development)
- Redis 7 or newer

Cassandra is not required and is not supported by this backend. The application
uses PostgreSQL-specific SQL, transactions, joins, JSONB, row locks, and
partitioning.

## Windows setup with Docker Desktop

Windows development uses Docker Desktop for PostgreSQL and Redis. Install or
update **App Installer** from the Microsoft Store so that `winget` is available,
then open PowerShell in the backend directory:

```powershell
cd C:\Drive-D\dmlinkProject\backend
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\bootstrap-windows.ps1
```

The script installs or verifies Git, Python 3, Node.js LTS/npm, and Docker
Desktop; starts Docker Desktop; waits for its Linux engine; creates `.env` only
when missing; installs npm dependencies; starts PostgreSQL and Redis with data
under `backend/.docker-data/`; runs migrations and seed data; and runs
typecheck, tests, and the build.

The script is safe to rerun and preserves an existing `.env`. Docker Desktop
must be running with Linux containers. If a newly installed command is not
available in the current PowerShell session, close PowerShell, open a new one,
and rerun the script.

After onboarding, start the Windows Docker services and API from PowerShell
with:

```powershell
npm run dev:windows
```

This starts Docker Desktop when it is installed, waits for its Linux engine,
starts PostgreSQL and Redis with Compose, verifies both containers, applies
migrations and seed data, and runs the API in the foreground. To skip database
setup when the database is already current, use
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-windows.ps1 -SkipDbSetup`.
Run `npm run dev:worker` in a second PowerShell window for the worker.

## Legacy WSL installer (not used for Windows development)

The repository still contains `scripts/bootstrap.sh` for historical Ubuntu/WSL
use, but do not run it for this Windows-only setup. It installs Linux-native
PostgreSQL and Redis, which have been removed from the current WSL environment.
Use `bootstrap-windows.ps1` instead.

The remaining WSL instructions below are retained only as historical reference.

On a new Ubuntu, Debian, or Ubuntu/Debian WSL machine, the legacy command was:

```bash
cd /path/to/dmlinkProject/backend
./scripts/bootstrap.sh
```

The script is safe to rerun. It installs the system packages, Node.js 22,
PostgreSQL, and Redis; starts the services; creates the local development role
and database; creates `.env` only when it is missing; installs locked npm
dependencies; runs migrations and seed data; and runs the typecheck, test, and
build checks. It never overwrites an existing `.env`.

The script uses native Ubuntu/Debian services. Use the Docker Compose steps in
the manual setup below instead if you want PostgreSQL and Redis in containers.

For a different local PostgreSQL name or role, set these environment variables
before running it. Passwords must be URL-safe because the script writes the
local `DATABASE_URL`:

```bash
DB_USER=instagram \
DB_PASSWORD=instagram \
DB_NAME=instagram_automation \
DB_HOST=127.0.0.1 \
./scripts/bootstrap.sh
```

If the configured role already exists with a different local-development
password, the script leaves it unchanged and stops. To explicitly replace that
role's password, add `RESET_DB_PASSWORD=1` to the command. This is intentionally
opt-in so the installer does not silently change credentials used by another
local project.

## 1. Install system packages

Run these commands in Ubuntu/WSL:

```bash
sudo apt update
sudo apt install -y \
  ca-certificates \
  curl \
  git \
  build-essential \
  python3 \
  python3-pip \
  python3-venv \
  postgresql \
  postgresql-contrib \
  redis-server \
  redis-tools
```

Verify the installed tools:

```bash
python3 --version
pip3 --version
psql --version
redis-server --version
redis-cli --version
```

## 2. Install Node.js and npm

The project requires Node.js 20 or newer. `nvm` is recommended so each
developer can use the same Node.js major version without changing system files:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm alias default 22
nvm use 22
node --version
npm --version
```

Node.js 20 is also supported. Do not install a version below 20.

## 3. Start PostgreSQL and Redis

For WSL distributions without systemd:

```bash
sudo service postgresql start
sudo service redis-server start
```

For WSL distributions with systemd enabled:

```bash
sudo systemctl enable --now postgresql
sudo systemctl enable --now redis-server
```

Verify both services:

```bash
pg_isready -h 127.0.0.1 -p 5432
redis-cli -h 127.0.0.1 -p 6379 ping
```

Expected output includes:

```text
accepting connections
PONG
```

The Redis health command is `redis-cli ping`; `redis-ping` is not a valid
command.

## 4. Create the local PostgreSQL database

The local `.env` uses this development connection:

```text
postgres://instagram:instagram@127.0.0.1:5432/instagram_automation
```

Create or reset the application role:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'instagram'
  ) THEN
    CREATE ROLE instagram LOGIN PASSWORD 'instagram';
  ELSE
    ALTER ROLE instagram WITH LOGIN PASSWORD 'instagram';
  END IF;
END
$$;
SQL
```

Create the database if it does not exist. (`createdb --if-not-exists` is not
available in PostgreSQL 18, so check first.)

```bash
DB_EXISTS=$(sudo -u postgres psql -d postgres -Atc \
  "SELECT 1 FROM pg_database WHERE datname = 'instagram_automation';")
if [ "${DB_EXISTS}" != "1" ]; then
  sudo -u postgres createdb --owner=instagram instagram_automation
fi
```

Verify the application credentials:

```bash
PGPASSWORD=instagram psql \
  -h 127.0.0.1 \
  -U instagram \
  -d instagram_automation \
  -c 'SELECT current_user, current_database();'
```

## 5. Configure and install the backend

Run these commands from the backend directory:

```bash
cd /path/to/dmlinkProject/backend
test -f .env || cp .env.example .env
npm ci
```

The local `.env` must contain at least:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
DATABASE_URL=postgres://instagram:instagram@127.0.0.1:5432/instagram_automation
REDIS_URL=redis://127.0.0.1:6379
META_APP_SECRET=local-development-app-secret
META_WEBHOOK_VERIFY_TOKEN=local-development-verify-token
```

Never commit `.env`. It is ignored by Git.

## 6. Apply migrations and insert test data

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:seed
```

The repeatable local seed creates:

- User: `developer@example.local`
- Password: `local-development-password`
- Workspace: `11111111-1111-4111-8111-111111111111`
- Instagram account: `33333333-3333-4333-8333-333333333333`
- Live guide automation: `44444444-4444-4444-8444-444444444444`

Running `npm run db:seed` more than once is safe.

## 7. Run and verify the backend

Start the API in terminal 1:

```bash
cd /path/to/dmlinkProject/backend
npm run dev
```

Start the worker in terminal 2:

```bash
cd /path/to/dmlinkProject/backend
npm run dev:worker
```

After onboarding, native PostgreSQL, Redis, database setup, and the API can be
started with one command:

```bash
npm run dev:all
```

This starts the API in the foreground. Start the worker separately with
`npm run dev:worker`. To use Docker Compose for PostgreSQL and Redis instead of
native services, run:

```bash
INFRA_MODE=docker npm run dev:all
```

In terminal 3, run the checks:

```bash
cd /path/to/dmlinkProject/backend
curl --fail-with-body http://localhost:3000/health
curl --fail-with-body -c .local-cookies -X POST \
  http://localhost:3000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"developer@example.local","password":"local-development-password"}'
curl --fail-with-body -b .local-cookies http://localhost:3000/v1/auth/me
npm run webhook:smoke
```

Expected health output:

```json
{"status":"ok"}
```

`/health` is liveness only. On Windows use
`curl.exe http://127.0.0.1:3000/ready` to verify both PostgreSQL and Redis;
readiness returns 503 if either is unavailable or times out.

The webhook smoke command should return HTTP 200. It creates a queued trigger
event for the seeded `guide` automation. The current foundation records the
matching result; it does not send a real Instagram DM.

## 8. Run project checks

```bash
npm run typecheck
npm test
npm run build
```

For the Windows Docker integration suite, start its separate disposable test
services (ports 15432 and 56379 by default), run tests, then stop them:

```cmd
npm run test:infra:up
npm run test:integration
npm run test:infra:down
```

These services do not use `backend/.docker-data` or the development database.
Do not point the integration suite at development or production databases.
See the README's isolated integration test section for safeguards and coverage.

## Troubleshooting

### `Unit postgresql.service not found`

PostgreSQL is not installed in that Ubuntu/WSL distribution. Run the system
package installation from step 1, then start the service.

### `Unit redis-server.service not found`

Redis is not installed. Run the system package installation from step 1. Use
`redis-cli ping` to test it after starting the service.

### `password authentication failed for user "instagram"`

Reset the role password using the command in step 4. The password must match the
`DATABASE_URL` in `.env`.

### PostgreSQL is accepting connections but migrations fail

Confirm the database exists and test the exact application connection:

```bash
PGPASSWORD=instagram psql \
  -h 127.0.0.1 \
  -U instagram \
  -d instagram_automation \
  -c 'SELECT 1;'
```

Do not switch `DATABASE_URL` to a Cassandra connection string. Cassandra would
require a separate data-model and persistence-layer implementation.
