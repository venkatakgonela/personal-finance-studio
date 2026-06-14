# Personal Finance Studio

Personal Finance Studio is a local-first Household and Business Finance Control Center.

The first release focuses on the Household entity using Snoop CSV imports. It helps answer:

- What money exists right now?
- What is already committed?
- What is flexible and safe to spend?
- What bills, credit cards, loans, and BNPL payments are due next?
- What will balances look like on a selected future date?

Implementation has started from the locked Phase 1 plan. The current slice supports Snoop import,
account and transaction review, internal transfer candidates, and recurring commitment candidates.

## Planning Docs

- [Project Charter](ai/00-project-charter.md)
- [Architecture](ai/01-architecture.md)
- [Domain Model](ai/02-domain-model.md)
- [Decisions / ADRs](ai/04-decisions.md)
- [Roadmap](ai/roadmap/ROADMAP.md)
- [Phase 1 Specification](ai/specs/SPEC-001-phase-1-household-snoop.md)
- [Screen & Design Specification](ai/specs/SPEC-002-screen-and-design-system.md)
- [Testing Strategy](ai/specs/SPEC-003-testing-strategy.md)

## Locked Direction

- Frontend: React + Vite + TypeScript
- Backend: FastAPI + Python
- Database: PostgreSQL
- Phase 1 integration: Snoop CSV import
- Phase 1 entity: Household
- Future entities/integrations: Business, Tide CSV, NatWest Business CSV, Open Banking, local LLM assistant

## Local Development

Backend:

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8025
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Database:

```bash
docker compose up -d
```

Default local ports:

- Backend API: `8025`
- Frontend: `5175`
- PostgreSQL: `5435`

## Quality Gates

Backend:

```bash
uv run ruff check .
uv run pytest
env DATABASE_URL=sqlite+pysqlite:////private/tmp/pfs_alembic_smoke.db uv run alembic upgrade head
```

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
```
