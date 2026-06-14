# TASK-006: Internal Transfer Detection

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Detect paired internal transfer candidates so same-money movements are reviewed as one event and excluded from spending/income calculations later.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-003-testing-strategy.md`
- `app/services/internal_transfers.py`

## 3. Checklist

- [x] Add internal transfer match model and schema.
- [x] Detect opposite-sign same-amount transactions across different accounts.
- [x] Limit transfer candidates to close date windows.
- [x] Avoid matching the same transaction twice.
- [x] Expose transfer detection API.
- [x] Add tests for pairing, idempotency, and same-account non-match.

## 4. Verification

```bash
uv run ruff check .
uv run pytest
```
