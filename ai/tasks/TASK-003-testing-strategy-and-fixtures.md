# TASK-003: Testing Strategy And Fixtures

**Status:** Draft  
**Assigned To:** TBD  
**Created Date:** 2026-06-14

## 1. Goal

Implement the test foundation for Phase 1 before or alongside the first functional slices.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-003-testing-strategy.md`
- `ai/04-decisions.md`

## 3. Checklist

- [ ] Configure backend test framework.
- [ ] Configure frontend unit/component test framework.
- [ ] Configure Playwright browser tests.
- [ ] Create sanitized CSV fixtures.
- [ ] Add import idempotency tests.
- [ ] Add internal transfer pairing tests.
- [ ] Add available-money formula tests.
- [ ] Add Decision Queue behavior tests.
- [ ] Add first end-to-end import-to-dashboard browser test.

## 4. Verification

Expected after implementation exists:

```bash
uv run pytest
npm run test
npm run test:e2e
```
