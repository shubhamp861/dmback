#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.production ]]; then
  printf '%s\n' 'Missing .env.production. Copy .env.production.example and replace all placeholders.' >&2
  exit 1
fi

docker compose --env-file .env.production -f docker-compose.yml up -d --build
docker compose --env-file .env.production -f docker-compose.yml ps
