#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"

docker compose up -d
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8025 &
BACKEND_PID="$!"

cd "${ROOT_DIR}/frontend"
npm run dev
