#!/usr/bin/env bash
# Starts the FastAPI backend and the Vite frontend; Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x backend/.venv/bin/uvicorn ]; then
  echo "Backend not set up yet — run: make setup" >&2
  exit 1
fi

trap 'kill 0' EXIT INT TERM
(cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app) &
(cd frontend && npm run dev -- --host 127.0.0.1) &
echo ""
echo "  PAOwerUp Careers → http://localhost:5173   (API: http://127.0.0.1:8000/api/health)"
echo ""
wait
