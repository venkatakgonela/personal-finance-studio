# SPEC-003: Testing Strategy

**Author:** Kiran Gonela / Codex  
**Status:** Draft  
**Date:** 2026-06-14

## 1. Problem Statement

Personal finance software must be trusted. A visually polished app is not useful if it duplicates imports, misclassifies transfers as spending, counts credit limits as cash, hides stale data, or forecasts balances incorrectly.

Testing is therefore part of the Phase 1 product, not a cleanup activity.

## 2. Goals

- Verify import correctness with real-shaped Snoop fixtures.
- Verify deterministic finance calculations.
- Verify internal transfers are paired, excluded from spend/income, and do not create duplicate decisions.
- Verify dashboard numbers match documented formulas.
- Verify browser UI flows work end to end.
- Prevent regression in the core money model before visual polish.

## 3. Non-Goals

- No real bank credentials or Open Banking tests in Phase 1.
- No testing against private raw production exports committed to git.
- No visual snapshot obsession; screenshots are useful, but financial correctness matters more.
- No LLM assistant tests in Phase 1.

## 4. Test Layers

### Backend Unit Tests

Use `pytest`.

Coverage:

- Snoop CSV parsing.
- Money parsing and sign handling.
- Transaction fingerprint generation.
- Category normalization.
- Internal transfer candidate scoring.
- Bill estimate calculation.
- Bill instance generation.
- Available money formula.
- Flexible spend remaining formula.
- Stale recurring commitment detection.

### Backend Integration Tests

Use test database fixtures.

Coverage:

- Import preview returns expected accounts, dates, row counts, warnings.
- Import commit writes transactions idempotently.
- Re-importing the same CSV creates no duplicates.
- Full-history import after a missed day upserts correctly and marks freshness.
- Internal transfer reconciliation links paired transactions.
- Dashboard API excludes transfers, credit limits, loans, and BNPL credit from available cash.
- Forecast API distinguishes actual, estimated, forecast, and pending values.

### Frontend Unit / Component Tests

Use Vitest + React Testing Library.

Coverage:

- Money formatting.
- Date range controls.
- Status badges.
- Actual/estimated/forecast/pending visual language.
- Dashboard card rendering.
- Decision Queue item behavior.

### Browser UI / E2E Tests

Use Playwright.

Critical flows:

1. Import Snoop CSV preview.
2. Confirm import and see detected accounts.
3. Classify account types and review balances.
4. Review internal transfer candidates and confirm a paired transfer.
5. Open Transactions and verify transfer is excluded from spending.
6. Confirm a recurring commitment candidate.
7. View Calendar for next 15 days.
8. View Dashboard and verify cash on hand, available after commitments, and flexible spend cards.
9. Mark a bill instance as paid with actual amount/date/account.
10. Re-import the same CSV and verify no duplicates.

### Manual Exploratory Testing

Before Phase 1 is considered ready:

- Use the real Snoop sample locally.
- Browse dashboard, calendar, transactions, accounts, bills, forecast, and decision queue.
- Confirm terminology feels understandable.
- Confirm Decision Queue is not noisy.
- Confirm the visual system makes estimates and forecasts obvious.

## 5. Fixtures

Fixtures should be sanitized and committed only if they contain no private data.

Required fixture types:

- Minimal valid Snoop CSV.
- Duplicate import fixture.
- Paired internal transfer fixture.
- Credit-card payment fixture.
- BNPL fixture.
- Variable bill fixture.
- Stale recurring bill fixture.
- Pending transaction fixture.
- Missing import day/full-history recovery fixture.

## 6. Quality Gates

Expected backend commands:

```bash
uv run ruff check .
uv run pytest
```

Expected frontend commands:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Exact commands may change once implementation is scaffolded, but equivalent gates must exist.

## 7. Release Criteria

Phase 1 is not ready until:

- [x] Core backend tests pass.
- [x] Import idempotency tests pass.
- [x] Transfer reconciliation tests pass.
- [x] Forecast formula tests pass.
- [x] Browser critical flows pass.
- [x] Manual browser review is completed with no blocking UX issues.
