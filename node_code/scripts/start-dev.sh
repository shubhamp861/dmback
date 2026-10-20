#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

INFRA_MODE="${INFRA_MODE:-native}"
RUN_DB_SETUP="${RUN_DB_SETUP:-1}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

log() {
  printf '\n[start-dev] %s\n' "$*"
}

die() {
  printf '\n[start-dev] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  die "Startup failed at line ${1}. Check the error above and rerun the script."
}

trap 'on_error "$LINENO"' ERR

usage() {
  cat <<'EOF'
Usage: ./scripts/start-dev.sh

Starts local PostgreSQL, Redis, database setup, and the backend API.
The default infrastructure mode is native Ubuntu/Debian services.

Environment overrides:
  INFRA_MODE=native     Use system PostgreSQL and Redis (default)
  INFRA_MODE=docker     Use docker compose PostgreSQL and Redis
  RUN_DB_SETUP=0        Skip migrations and seed data
  DB_HOST=127.0.0.1
  DB_PORT=5432
  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379

The API stays in the foreground. Stop it with Ctrl-C.
The worker is not started by this script; run `npm run dev:worker` separately.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

[[ -z "${1:-}" ]] || die "Unknown argument '$1'. Use --help for usage."
[[ "${EUID}" -ne 0 ]] || die "Run this script as your normal user, not root."
[[ "${INFRA_MODE}" == "native" || "${INFRA_MODE}" == "docker" ]] || die "INFRA_MODE must be native or docker."
[[ "${RUN_DB_SETUP}" == "0" || "${RUN_DB_SETUP}" == "1" ]] || die "RUN_DB_SETUP must be 0 or 1."
[[ -f "${PROJECT_ROOT}/package.json" ]] || die "package.json was not found."
[[ -f "${PROJECT_ROOT}/.env" ]] || die "${PROJECT_ROOT}/.env is missing. Run bootstrap.sh or copy .env.example first."
command -v npm >/dev/null 2>&1 || die "npm is required. Run bootstrap.sh first."
[[ -x "${PROJECT_ROOT}/node_modules/.bin/tsx" ]] || die "npm dependencies are missing. Run npm ci first."

start_native_services() {
  command -v sudo >/dev/null 2>&1 || die "sudo is required for native services."
  sudo -v

  log "Starting native PostgreSQL and Redis services"
  if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql
    sudo systemctl start redis-server
  else
    sudo service postgresql start
    sudo service redis-server start
  fi
}

start_docker_services() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed or not available in PATH."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

  log "Starting PostgreSQL and Redis with Docker Compose"
  docker compose --file "${PROJECT_ROOT}/docker-compose.yml" up -d --wait
}

check_services() {
  log "Checking PostgreSQL and Redis connectivity"
  pg_isready -h "${DB_HOST}" -p "${DB_PORT}"
  [[ "$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping)" == "PONG" ]] \
    || die "Redis did not respond with PONG."
}

prepare_database() {
  [[ "${RUN_DB_SETUP}" == "1" ]] || {
    log "Skipping migrations and seed data because RUN_DB_SETUP=0"
    return
  }

  log "Applying migrations"
  npm run db:migrate
  npm run db:migrate:status

  log "Applying repeatable local seed data"
  npm run db:seed
}

start_api() {
  log "Starting the backend API"
  log "API will remain in the foreground. Press Ctrl-C to stop it."
  exec npm run dev
}

if [[ "${INFRA_MODE}" == "docker" ]]; then
  start_docker_services
else
  start_native_services
fi

check_services
prepare_database
start_api
