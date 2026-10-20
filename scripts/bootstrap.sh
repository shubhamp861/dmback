#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly NVM_VERSION="0.40.3"
readonly NODE_VERSION="22"

DB_USER="${DB_USER:-instagram}"
DB_PASSWORD="${DB_PASSWORD:-instagram}"
DB_NAME="${DB_NAME:-instagram_automation}"
DB_HOST="${DB_HOST:-127.0.0.1}"
RESET_DB_PASSWORD="${RESET_DB_PASSWORD:-0}"

log() {
  printf '\n[bootstrap] %s\n' "$*"
}

die() {
  printf '\n[bootstrap] ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  die "Bootstrap failed at line ${1}. Check the error above and rerun the script."
}

trap 'on_error "$LINENO"' ERR

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap.sh

Installs and configures the local Ubuntu/WSL prerequisites for the backend.
Run it as a normal user with sudo access from the backend repository.

Optional environment overrides for the local PostgreSQL database:
  DB_USER=instagram
  DB_PASSWORD=instagram
  DB_NAME=instagram_automation
  DB_HOST=127.0.0.1
  RESET_DB_PASSWORD=1  # only when the existing role password must be replaced

The script does not overwrite an existing .env file.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

[[ -z "${1:-}" ]] || die "Unknown argument '$1'. Use --help for usage."
[[ "${EUID}" -ne 0 ]] || die "Run this script as your normal user, not root. It uses sudo when needed."
[[ -f "${PROJECT_ROOT}/package.json" ]] || die "package.json was not found. Run this script from a backend checkout."
[[ -f "${PROJECT_ROOT}/package-lock.json" ]] || die "package-lock.json was not found. The locked npm dependencies are required."

[[ "${DB_USER}" =~ ^[a-z_][a-z0-9_]*$ ]] || die "DB_USER must contain only lowercase letters, digits, and underscores."
[[ "${DB_NAME}" =~ ^[a-z_][a-z0-9_]*$ ]] || die "DB_NAME must contain only lowercase letters, digits, and underscores."
[[ "${DB_PASSWORD}" =~ ^[A-Za-z0-9._~-]+$ ]] || die "DB_PASSWORD must be URL-safe letters, digits, '.', '_', '~', or '-'."
[[ "${RESET_DB_PASSWORD}" == "0" || "${RESET_DB_PASSWORD}" == "1" ]] || die "RESET_DB_PASSWORD must be 0 or 1."

if [[ ! -r /etc/os-release ]]; then
  die "Cannot identify the operating system. This installer supports Ubuntu and Debian only."
fi

# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}" in
  ubuntu|debian)
    ;;
  *)
    die "Unsupported operating system '${ID:-unknown}'. Use Ubuntu, Debian, or WSL with an Ubuntu/Debian distribution."
    ;;
esac

command -v sudo >/dev/null 2>&1 || die "sudo is required. Install it or ask an administrator to run the prerequisite steps."
sudo -v

install_system_packages() {
  log "Installing Python, build tools, PostgreSQL, Redis, and supporting packages"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    build-essential \
    openssl \
    python3 \
    python3-pip \
    python3-venv \
    postgresql \
    postgresql-contrib \
    redis-server \
    redis-tools
}

node_major() {
  node --version | tr -d 'v' | cut -d '.' -f 1
}

has_supported_node() {
  command -v node >/dev/null 2>&1 || return 1
  [[ "$(node_major)" =~ ^[0-9]+$ ]] || return 1
  (( $(node_major) >= 20 ))
}

install_node() {
  if has_supported_node && command -v npm >/dev/null 2>&1; then
    log "Using Node.js $(node --version) and npm $(npm --version) already installed on this machine"
    return
  fi

  log "Installing Node.js ${NODE_VERSION} through pinned nvm ${NVM_VERSION}"
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  if [[ ! -s "${NVM_DIR}/nvm.sh" ]]; then
    local installer
    installer="$(mktemp)"
    curl --fail --silent --show-error --location \
      "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" \
      --output "${installer}"
    bash "${installer}"
    rm -f -- "${installer}"
  fi

  [[ -s "${NVM_DIR}/nvm.sh" ]] || die "nvm installation did not create ${NVM_DIR}/nvm.sh"
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
  command -v nvm >/dev/null 2>&1 || die "nvm could not be loaded in the current shell"
  nvm install "${NODE_VERSION}"
  nvm alias default "${NODE_VERSION}"
  nvm use "${NODE_VERSION}"

  has_supported_node || die "The installed Node.js version is below the required major version 20."
  command -v npm >/dev/null 2>&1 || die "npm was not installed with Node.js."
  log "Using Node.js $(node --version) and npm $(npm --version)"
}

start_service() {
  local service_name="$1"
  if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now "${service_name}"
  else
    sudo service "${service_name}" start
  fi
}

start_services() {
  log "Starting PostgreSQL and Redis"
  start_service postgresql
  start_service redis-server

  pg_isready -h "${DB_HOST}" -p 5432
  [[ "$(redis-cli -h "${DB_HOST}" -p 6379 ping)" == "PONG" ]] || die "Redis did not respond with PONG."
}

configure_database() {
  log "Creating or updating the local PostgreSQL role and database"
  sudo -u postgres psql --dbname=postgres --set=ON_ERROR_STOP=1 \
    --set="db_user=${DB_USER}" \
    --set="db_password=${DB_PASSWORD}" \
    --set="db_name=${DB_NAME}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user');
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name');
\gexec
SQL

  if [[ "${RESET_DB_PASSWORD}" == "1" ]]; then
    log "Resetting the password for the configured local PostgreSQL role"
    sudo -u postgres psql --dbname=postgres --set=ON_ERROR_STOP=1 \
      --set="db_user=${DB_USER}" \
      --set="db_password=${DB_PASSWORD}" <<'SQL'
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user');
\gexec
SQL
  fi

  if ! PGPASSWORD="${DB_PASSWORD}" psql \
      --no-password \
      --host="${DB_HOST}" \
      --username="${DB_USER}" \
      --dbname="${DB_NAME}" \
      --command='SELECT 1;' >/dev/null; then
    die "Could not connect with DB_USER/DB_PASSWORD. Existing local credentials were not changed; set matching DB_* variables or rerun with RESET_DB_PASSWORD=1."
  fi
}

create_local_env() {
  if [[ -e "${PROJECT_ROOT}/.env" ]]; then
    [[ -f "${PROJECT_ROOT}/.env" ]] || die "${PROJECT_ROOT}/.env exists but is not a regular file."
    chmod 600 "${PROJECT_ROOT}/.env"
    log "Preserving existing .env"
    return
  fi

  log "Creating a local development .env"
  local token_key
  local verify_token
  token_key="$(openssl rand -base64 32)"
  verify_token="$(openssl rand -hex 32)"
  umask 077
  cat > "${PROJECT_ROOT}/.env" <<EOF
NODE_ENV=development
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}
REDIS_URL=redis://${DB_HOST}:6379
META_APP_ID=development-app-id
META_APP_SECRET=development-app-secret
META_REDIRECT_URI=http://127.0.0.1:3000/v1/auth/instagram/callback
META_API_VERSION=v23.0
META_GRAPH_BASE_URL=https://graph.instagram.com
META_OAUTH_BASE_URL=https://api.instagram.com
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
META_WEBHOOK_VERIFY_TOKEN=${verify_token}
TOKEN_ENCRYPTION_KEY=${token_key}
WEB_ORIGIN=http://127.0.0.1:3001
LOG_LEVEL=info
EOF
  chmod 600 "${PROJECT_ROOT}/.env"
}

install_project_dependencies() {
  log "Installing locked npm dependencies"
  npm --prefix "${PROJECT_ROOT}" ci
}

initialize_project() {
  log "Applying database migrations and seed data"
  npm --prefix "${PROJECT_ROOT}" run db:migrate
  npm --prefix "${PROJECT_ROOT}" run db:migrate:status
  npm --prefix "${PROJECT_ROOT}" run db:seed
}

run_project_checks() {
  log "Running typecheck, tests, and build"
  npm --prefix "${PROJECT_ROOT}" run typecheck
  npm --prefix "${PROJECT_ROOT}" test
  npm --prefix "${PROJECT_ROOT}" run build
}

print_summary() {
  cat <<EOF

Onboarding is complete.

Installed and configured:
  - Python 3, pip, and venv
  - Node.js $(node --version) and npm $(npm --version)
  - PostgreSQL at ${DB_HOST}:5432/${DB_NAME}
  - Redis at ${DB_HOST}:6379
  - Backend dependencies, migrations, and local seed data

Start the API in one terminal:
  npm --prefix "${PROJECT_ROOT}" run dev

Start the worker in a second terminal:
  npm --prefix "${PROJECT_ROOT}" run dev:worker

This is a development setup. Do not use the generated local credentials or
development secrets for production.
EOF
}

install_system_packages
install_node
start_services
configure_database
create_local_env
install_project_dependencies
initialize_project
run_project_checks
print_summary
