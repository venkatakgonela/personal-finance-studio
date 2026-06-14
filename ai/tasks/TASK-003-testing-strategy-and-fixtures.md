# TASK-003: Testing Strategy And Fixtures

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Implement the test foundation for Phase 1 before or alongside the first functional slices.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-003-testing-strategy.md`
- `ai/04-decisions.md`

## 3. Checklist

- [x] Configure backend test framework.
- [x] Configure frontend unit/component test framework.
- [x] Configure Playwright browser tests.
- [x] Create sanitized CSV fixtures.
- [x] Add import idempotency tests.
- [x] Add internal transfer pairing tests.
- [x] Add available-money formula tests.
- [x] Add Decision Queue behavior tests.
- [x] Add browser tests for real-stack dashboard fetch, transaction filters, and Decision Queue layout.

## 4. Verification

Expected after implementation exists:

```bash
uv run pytest
npm run test
npm run test:e2e
```

Current results as of 2026-06-14:

- `uv run pytest`: 34 passed.
- `npm run test`: 2 passed.
- `npm run test:e2e`: 5 passed.
