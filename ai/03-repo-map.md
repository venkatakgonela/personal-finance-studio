<!---
ai-eos-metadata:
  purpose: "Repository layout and navigation guide."
  how_to_use: "Consult to find project context and current implementation areas."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Repo Map - Personal Finance Studio

**Last reviewed:** 2026-06-15
**Current repository status:** Phase 2 household expansion, FreeAgent manual-token import, overdraft semantics, and dashboard personalization complete locally.

## Root

- `README.md`: project overview and local development notes.
- `AGENTS.md`: AI agent operating rules.
- `.ai-eos.yaml`: Genesis-compatible manifest.
- `docker-compose.yml`: local PostgreSQL runtime.
- `pyproject.toml`: Python project, dependencies, pytest and ruff configuration.
- `alembic/`: database migration environment.
- `ai/`: planning, architecture, specs, tasks, roadmap, epics, features, agent profiles, context
  packs, skills, run records, and operational context.

## Backend

- `app/main.py`: FastAPI app factory, CORS, `/health`, and route registration.
- `app/config.py`: environment-driven settings.
- `app/db.py`: SQLAlchemy engine/session setup.
- `app/models/`: SQLAlchemy entities for Household/Profile, accounts, transactions, import logs, internal transfer matches, commitments, bill instances, and integration connections.
- `app/schemas/`: Pydantic response/request schemas for all API surfaces, including reset/data
  management responses.
- `app/routes/`: FastAPI routers for imports, accounts, transactions, transfers, commitments, calendar, forecast, dashboard, insights, planning, decisions, and FreeAgent integrations.
- `app/services/`: deterministic finance logic for parsing/imports, category normalization, transfer detection, commitment detection, account balance/overdraft semantics, dashboard math, calendar/upcoming, forecast, insights, Phase 1.5 planning overview, transaction review, Decision Queue actions, encrypted secret handling, FreeAgent API import, and imported-data reset.

## Frontend

- `frontend/src/App.tsx`: current route shell, Phase 1/1.5 UI components, Phase 1.75 editable
  planning controls, Phase 2 rule/merchant/scenario/budget/export workflows, URL-hash state
  persistence, shared contextual help tooltips, first-run import personalization, calendar planner,
  FreeAgent import workflow, safe-spend assumptions, dashboard widget personalization, and D3 Sankey report model/rendering.
- `frontend/src/api.ts`: typed API client for backend routes, query params, and in-flight GET request de-duplication.
- `frontend/src/styles.css`: design tokens, layout, tables, filters, contextual help tooltip
  placement/stacking, dashboard widget/drag overlay styling, auto-animated section/list motion, and responsive styles.
- `frontend/src/App.test.tsx`: Vitest/React Testing Library component coverage.
- `frontend/e2e/app.spec.ts`: Playwright browser coverage for real-stack dashboard smoke, transaction filters, refresh-persisted URL state, Phase 1.5/1.75 planning routes, profile-menu navigation, calendar planner behavior, report/account graphics, route-health/overflow checks, and Decision Queue layout.
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
- `tests/test_freeagent_import.py`: FreeAgent validation/import/dedupe and API-client behavior coverage.
- `tests/test_api.py`: FastAPI endpoint smoke, filter coverage, and imported-data reset coverage.
- `tests/test_phase1_completion.py`: completion-slice regression coverage for transaction review, forecast, bill payment, insights, and Phase 1.5 planning overview.
- `tests/test_phase2_household_expansion.py`: Phase 2 category normalization guard for rule-applied group labels.

## AI-EOS Operating Context

- `ai/epics/`: roadmap-level phase groupings derived from the charter, roadmap, specs, and backlog.
- `ai/features/`: feature-level records mapped to epics, source tasks, acceptance criteria, and verification anchors.
- `ai/agents/`: specialized agent role profiles for finance architecture, backend data, frontend product, and quality/release work.
- `ai/context-packs/`: task-scoped context loading policies for default, backend-data, frontend-UI, product-planning, and Phase 2.1 work.
- `ai/skills/`: reusable work-mode guidance for feature development, regression testing, database migration, UI changes, refactoring, and documentation.
- `ai/runs/`: run templates and execution records, including the AI-EOS alignment run.

## Generated/Ignored Runtime Areas

- `frontend/node_modules/`: dependency install output; do not edit manually.
- `frontend/dist/`: production build output.
- `data/pfs_secret.key`: local encryption key file when generated; never commit real key material.
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
