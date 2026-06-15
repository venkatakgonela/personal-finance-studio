# TASK-005: Persist Snoop Imports

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Move from Snoop preview-only behavior to an idempotent persisted import foundation.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-003-testing-strategy.md`
- `app/services/snoop_import.py`
- `app/services/import_commit.py`

## 3. Checklist

- [x] Add SQLAlchemy database foundation.
- [x] Add initial Alembic migration.
- [x] Add entity/profile/account/import/transaction models.
- [x] Add idempotent Snoop import commit endpoint.
- [x] Create Household and Primary user defaults during import.
- [x] Upsert detected accounts.
- [x] Skip duplicate transaction fingerprints.
- [x] Add persistence and API tests.

## 4. Verification

```bash
uv run ruff check .
uv run pytest
env DATABASE_URL=sqlite+pysqlite:////private/tmp/pfs_alembic_smoke.db uv run alembic upgrade head
```
