<!---
ai-eos-metadata:
  purpose: "Style, syntax, and structural coding rules."
  how_to_use: "Read before implementation. Update once tooling is scaffolded."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Coding Standards - Personal Finance Studio

Implementation has started. These standards are binding unless an ADR changes them.

## Backend

- Python 3.12+
- FastAPI, Pydantic, SQLAlchemy, Alembic.
- Prefer explicit service classes/functions for finance calculations.
- Keep deterministic calculations outside route handlers.
- Use decimal-safe money handling. Do not use floats for persisted money values.
- Tests should cover import parsing, deduplication, internal transfer matching, bill instance generation, and forecasts.

Expected commands:

```bash
uv run ruff check .
uv run pytest
```

## Frontend

- React + Vite + TypeScript.
- Prefer route-level pages and reusable domain components.
- Use CSS variables from `SPEC-002` for palette, spacing, and typography.
- Use tabular numbers for financial values.
- Do not add charts where a table/timeline gives clearer decisions.
- Keep Playwright tests deterministic: mock volatile UI data when testing layout/filter behavior, but retain at least one real-stack smoke test for API availability.

Expected commands:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

`npm run test:e2e` is expected to check both `127.0.0.1:8025/health` and the Vite app.

## General

- Keep Household and Business data entity-scoped.
- Make actual/estimated/forecast/pending values visually distinct.
- Avoid noisy notifications; Decision Queue should stay high-impact.
