<!---
ai-eos-metadata:
  purpose: "Task-scoped context pack for backend, database, import, and finance-service work."
  how_to_use: "Load for FastAPI, SQLAlchemy, Alembic, import, transfer, commitment, forecast, or API changes."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# Context Pack: Backend Data

## 1. Required Context

- [AGENTS.md](file:///AGENTS.md)
- [Architecture](file:///ai/01-architecture.md)
- [Domain Model](file:///ai/02-domain-model.md)
- [Repo Map](file:///ai/03-repo-map.md)
- Relevant feature/task file under `ai/features/` or `ai/tasks/`.

## 2. Add When Relevant

- [SPEC-001: Phase 1 Household Snoop](file:///ai/specs/SPEC-001-phase-1-household-snoop.md) for import, account, transaction, transfer, commitment, forecast, or dashboard foundations.
- [SPEC-003: Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md) for test coverage and release criteria.
- [Database Migration Skill](file:///ai/skills/database-migration.md) for schema changes.
- [Risk Register](file:///ai/08-risk-register.md) for privacy, data integrity, or destructive workflows.

## 3. Source Areas

- `app/models/`
- `app/schemas/`
- `app/routes/`
- `app/services/`
- `alembic/versions/`
- `tests/`

## 4. Verification

- `uv run ruff check .`
- `uv run pytest`
- `uv run alembic upgrade head` when migrations change.
