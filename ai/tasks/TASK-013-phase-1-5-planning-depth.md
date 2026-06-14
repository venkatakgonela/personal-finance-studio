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
- Planning UI shows emergency/review goals, monthly set-asides, monthly review actions,
  subscription prompts, import freshness, and stale commitment reviews.
- Route-health E2E coverage now checks every primary route for failed-fetch text, dead hash links,
  unnamed buttons, and horizontal overflow.

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

## Deferred

- Persisted custom/user-authored goals.
- Editable sinking-fund targets independent of detected commitments.
- Exportable report snapshots.
- Forecast generated timestamp and structured app logs.
