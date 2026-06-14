<!---
ai-eos-metadata:
  purpose: "Repository layout and navigation guide."
  how_to_use: "Consult to find project context and current implementation areas."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Repo Map - Personal Finance Studio

**Last reviewed:** 2026-06-14  
**Current repository status:** Phase 1.5 local implementation with backend, frontend, tests, and docs.

## Root

- `README.md`: project overview and local development notes.
- `AGENTS.md`: AI agent operating rules.
- `.ai-eos.yaml`: Genesis-compatible manifest.
- `docker-compose.yml`: local PostgreSQL runtime.
- `pyproject.toml`: Python project, dependencies, pytest and ruff configuration.
- `alembic/`: database migration environment.
- `ai/`: planning, architecture, specs, tasks, roadmap, and operational context.

## Backend

- `app/main.py`: FastAPI app factory, CORS, `/health`, and route registration.
- `app/config.py`: environment-driven settings.
- `app/db.py`: SQLAlchemy engine/session setup.
- `app/models/`: SQLAlchemy entities for Household/Profile, accounts, transactions, import logs, internal transfer matches, commitments, and bill instances.
- `app/schemas/`: Pydantic response/request schemas for all API surfaces.
- `app/routes/`: FastAPI routers for imports, accounts, transactions, transfers, commitments, calendar, forecast, dashboard, insights, planning, and decisions.
- `app/services/`: deterministic finance logic for parsing/imports, category normalization, transfer detection, commitment detection, dashboard math, calendar/upcoming, forecast, insights, Phase 1.5 planning overview, transaction review, and Decision Queue actions.

## Frontend

- `frontend/src/App.tsx`: current route shell and Phase 1/1.5 UI components.
- `frontend/src/api.ts`: typed API client for backend routes and query params.
- `frontend/src/styles.css`: design tokens, layout, tables, filters, and responsive styles.
- `frontend/src/App.test.tsx`: Vitest/React Testing Library component coverage.
- `frontend/e2e/app.spec.ts`: Playwright browser coverage for real-stack dashboard smoke, transaction filters, Phase 1.5 planning routes, route-health/overflow checks, and Decision Queue layout.
- `frontend/playwright.config.ts`: starts/checks both FastAPI (`8025`) and Vite (`5175`) for E2E.

## Tests

- `tests/fixtures/`: sanitized Snoop-shaped CSV fixtures.
- `tests/test_snoop_import.py`: parser/preview coverage.
- `tests/test_import_commit.py`: persisted import and idempotency coverage.
- `tests/test_internal_transfers.py`: internal transfer detection coverage.
- `tests/test_accounts_transactions.py`: account summary and transaction ledger/filter coverage.
- `tests/test_commitments.py`: recurring commitment and bill instance coverage.
- `tests/test_dashboard_calendar.py`: dashboard and upcoming/calendar coverage.
- `tests/test_decisions.py`: Decision Queue service/action coverage.
- `tests/test_api.py`: FastAPI endpoint smoke and filter coverage.
- `tests/test_phase1_completion.py`: completion-slice regression coverage for transaction review, forecast, bill payment, insights, and Phase 1.5 planning overview.

## Generated/Ignored Runtime Areas

- `frontend/node_modules/`: dependency install output; do not edit manually.
- `frontend/dist/`: production build output.
- `.venv/`, `__pycache__/`, `.pytest_cache/`, `test-results/`: generated runtime/test artifacts.

## Current Quality Gates

```bash
uv run ruff check .
uv run pytest
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test
cd frontend && npm run test:e2e
```
