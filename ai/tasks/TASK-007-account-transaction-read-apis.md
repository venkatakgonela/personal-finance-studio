# TASK-007: Account And Transaction Read APIs

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Expose persisted accounts and transactions so the UI can start using real imported data.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `app/services/accounts.py`
- `app/services/transactions.py`

## 3. Checklist

- [x] Add account summary schema and service.
- [x] Add transaction ledger schema and service.
- [x] Add transfer-aware transaction filtering.
- [x] Add account summary API.
- [x] Add transaction ledger API.
- [x] Add service and API tests.

## 4. Verification

```bash
uv run ruff check .
uv run pytest
```
