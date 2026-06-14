<!---
ai-eos-metadata:
  purpose: "Style, syntax, and structural coding rules."
  how_to_use: "Read before implementation. Update once tooling is scaffolded."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Coding Standards - Personal Finance Studio

Implementation has not started. These standards are provisional and become binding once code exists.

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
- Use Tailwind design tokens for palette, spacing, and typography.
- Use tabular numbers for financial values.
- Do not add charts where a table/timeline gives clearer decisions.

Expected commands:

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## General

- Keep Household and Business data entity-scoped.
- Make actual/estimated/forecast/pending values visually distinct.
- Avoid noisy notifications; Decision Queue should stay high-impact.
