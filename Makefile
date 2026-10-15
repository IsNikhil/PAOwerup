# PAOwerUp Careers — common tasks.  Requires Python 3.11, Node 20+, FFmpeg.
PYTHON ?= python3.11
VENV   := backend/.venv
PY     := $(VENV)/bin/python

.PHONY: setup dev backend frontend test build clean

setup: ## create the Python venv, install backend + frontend deps, create backend/.env
	@command -v ffmpeg >/dev/null || echo "⚠️  FFmpeg not found — install it (brew install ffmpeg) for interview transcription"
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r backend/requirements.txt
	cd frontend && npm install
	@test -f backend/.env || cp backend/.env.example backend/.env
	@echo "✅ Setup done. Optional: add GEMINI_API_KEY to backend/.env, then run: make dev"

dev: ## run backend (:8000) and frontend (:5173) together
	./scripts/dev.sh

backend:
	cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app

frontend:
	cd frontend && npm run dev

test: ## backend unit + integration tests (first run downloads USE, ~1 GB)
	cd backend && .venv/bin/python -m pytest -q

build: ## production build of the frontend
	cd frontend && npm run build

clean:
	rm -rf $(VENV) frontend/node_modules frontend/dist
