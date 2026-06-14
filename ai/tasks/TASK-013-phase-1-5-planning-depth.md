<!---
ai-eos-metadata:
  purpose: "Task record for Phase 1.5 planning-depth implementation."
  how_to_use: "Consult to understand what was delivered in the Phase 1.5 slice and what remains deferred."
  generated_by: "Codex implementation update"
--->

# TASK-013: Phase 1.5 Planning Depth

**Status:** Complete locally  
**Completed:** 2026-06-14

## Objective

Make Personal Finance Studio feel like a real planning product after import/review basics by adding
goals, sinking funds, monthly review, subscription review, saved filter drilldowns, import
freshness, and stale commitment diagnostics.

## Delivered

- `GET /api/planning/overview` derives planning data from accounts, transactions, commitments,
  decisions, and import logs.
- New frontend routes:
  - `#/goals`
  - `#/sinking-funds`
  - `#/monthly-review`
  - `#/subscriptions`
- Reports now include saved filters that deep-link into filtered transactions and planning views.
- Hash query parsing applies saved transaction filters such as group, type, review status, search,
  and date range.
- URL-hash persistence now also covers global date range, custom dates, search, include-candidates,
  Reports tab, and Reports grouping so refresh preserves context and only values reload.
- Planning UI shows emergency/review goals, monthly set-asides, monthly review actions,
  subscription prompts, import freshness, and stale commitment reviews.
- Route-health E2E coverage now checks every primary route for failed-fetch text, dead hash links,
  unnamed buttons, and horizontal overflow.
- Dashboard polish now includes a UK time-aware greeting, GBP-only money formatting, focused
  household-position hero, Spending Pulse category bars, compact Decision Queue preview, setup
  guidance only when the workspace is incomplete, fixed sidebar scrolling, and date-aware bill
  titles for historical/current/future ranges.
- Calendar polish now includes a selected-period planner grid, daily planned totals, commitment
  chips, busiest-day summary, candidate-toggle-aware results, and collapsible recent/current/upcoming
  bill rows.
- Reports polish now includes a D3 Sankey chart for Cash Flow, Spending, and Income, category vs
  merchant/source grouping, expandable spending leaves, Income source breakdown, square node bars,
  final labels kept inside the chart, visible summary flows, and lighter annotation typography so
  labels do not dominate the flow bands.
- Refresh performance was improved by de-duplicating identical in-flight frontend GET requests,
  reducing duplicate local API traffic caused by React dev StrictMode.

## Validation

Commands run successfully:

```bash
uv run ruff check app tests
uv run pytest
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm run test:e2e
```

Latest dashboard, calendar, and reports polish verification also passed:

```bash
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test:e2e -- --grep "colorful account and report graphics"
cd frontend && npm run test:e2e -- --grep "dashboard|preserves filters"
cd frontend && npm run test:e2e
```

## Deferred

- Persisted custom/user-authored goals.
- Editable sinking-fund targets independent of detected commitments.
- Exportable report snapshots.
- Forecast generated timestamp and structured app logs.
