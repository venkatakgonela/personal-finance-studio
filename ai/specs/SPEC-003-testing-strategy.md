# SPEC-003: Testing Strategy

**Author:** Kiran Gonela / Codex  
**Status:** Phase 1.5 implemented locally  
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
- Verify Phase 1.5 planning derivations and route health.
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
- Phase 1.5 planning overview derivation from transactions, commitments, decisions, and imports.

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

Current implemented checks:

1. Real local stack loads dashboard data without a `Failed to fetch` banner.
2. Dashboard renders the polished visual system, primary navigation, Balance Readiness, Spending Pulse, compact Decision Queue preview, and date-aware bills titles.
3. Transaction filters send API query params and update the table.
4. Decision Queue renders as a desktop review table with summary spacing.
5. Decision Queue remains usable on mobile.
6. Phase 1.5 planning routes render Goals, Sinking Funds, Monthly Review, and Subscriptions.
7. Saved filter URLs persist query state into the Transactions filters.
8. Every primary route is reachable without failed-fetch text, dead hash links, unnamed buttons, or horizontal overflow.
9. Candidate toggle is scoped to planning views and changes upcoming-bill results.
10. Sidebar remains fixed while page content scrolls.
11. Calendar planner renders selected-period bill chips and updates when candidates are excluded.
12. Reports render colorful account/report graphics, including the D3 Sankey chart and grouping controls.
13. URL-hash state persists date range, search, transaction filters, report tab, and report grouping
    across browser refresh.

Additional critical flows to add as Phase 1.5/packaging hardens:

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
- Browse dashboard, calendar, transactions, accounts, bills, forecast, goals, sinking funds, monthly review, subscriptions, reports, settings, and decision queue.
- Confirm the dashboard greeting follows UK local time and selected bill windows are not mislabeled.
- Confirm Household money formatting is GBP-only.
- Confirm Calendar labels historical/current/future bill windows correctly and shows planned amounts on
  the appropriate days.
- Confirm Reports Sankey labels stay close to the relevant bars, final nodes remain inside the chart,
  category/merchant grouping changes the destinations, spending leaves expand on click, and Income
  defaults to source breakdown.
- Confirm browser refresh preserves the user's current route context and updates values without
  resetting filters or report selections.
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

Playwright now starts/checks both the backend API and the frontend dev server:

- API: `http://127.0.0.1:8025/health`
- Frontend: `http://127.0.0.1:5175`

This is intentional so the E2E suite catches the common `Failed to fetch` class of regression.

The frontend also de-duplicates identical in-flight GET requests. This keeps React dev StrictMode
from doubling backend traffic during local refresh while preserving StrictMode checks.

## 7. Release Criteria

Phase 1.5 is not ready until:

- [x] Core backend tests pass.
- [x] Import idempotency tests pass.
- [x] Transfer reconciliation tests pass.
- [x] Forecast formula tests pass.
- [x] Browser critical flows pass.
- [x] Manual browser review is completed with no blocking UX issues.
- [x] Phase 1.5 planning overview tests pass.
- [x] All-route browser health checks pass.
