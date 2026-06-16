<!---
ai-eos-metadata:
  purpose: "Feature record for transfer detection, recurring commitments, and decision review."
  how_to_use: "Use when changing transfer, commitment, recurring bill, or Decision Queue behavior."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-002: Transfers, Commitments, And Decision Queue

**Epic:** [EPIC-001: Household Control Center](file:///ai/epics/EPIC-001-household-control-center.md)  
**Status:** Complete locally  

## 1. Description & User Stories

- **Description:** Detect likely internal transfers and recurring commitments, route high-impact
  candidates to a human review queue, support transaction-backed and manual commitment creation
  when detection misses a bill, model finite commitments such as BNPL, and keep spending/income
  calculations from being inflated.
- **As a** household finance user **I want to** confirm, create from transactions, and time-box recurring bills **so
  that** the app can produce trustworthy reports and forecasts without pretending every payment
  lasts forever.

## 2. Acceptance Criteria

- [x] Internal transfer candidates are detected and can be confirmed or rejected.
- [x] Recurring commitment candidates are detected and can be reviewed.
- [x] Real outflow transactions can be used as source evidence for a new commitment.
- [x] Missed bills can be added manually from Recurring.
- [x] Finite commitments can end after a date or a fixed number of payments.
- [x] Transfers are first-class records, not category hacks.
- [x] Decision Queue stays focused on high-impact review items.

## 2.1 Commitment-Inbox Design

Recurring uses a "commitment inbox" model:

- Detection proposes candidates from transaction patterns.
- User confirmation decides whether a candidate becomes a protected bill; user rejection/ignore
  prevents false recurring assumptions from entering planning.
- Transaction-backed creation lets the user pick a valid outflow from either Recurring or the
  Transactions ledger, add a separate household reference, categorize it, edit the planning amount,
  and preserve source evidence/source label.
- Transaction advice can be dismissed locally when the user knows a transaction is not recurring.
- Manual entry remains the fallback when detection misses a real recurring commitment with no
  usable imported transaction.
- Finite plans, especially BNPL and short loan/payment plans, can be capped by payment count or end date.
- Confirmed commitments feed Calendar, Cash Flow, Budget, Dashboard, Sinking Funds, and Subscriptions.

This follows commitment accounting, envelope budgeting, mental accounting, and guardrail budgeting:
money required by future commitments is treated as already spoken for before discretionary spend.

## 3. Source Tasks

- [x] [TASK-006: Internal Transfer Detection](file:///ai/tasks/TASK-006-internal-transfer-detection.md)
- [x] [TASK-009: Recurring Commitment Candidates](file:///ai/tasks/TASK-009-recurring-commitment-candidates.md)
- [x] [TASK-010: Dashboard Calendar Account Review](file:///ai/tasks/TASK-010-dashboard-calendar-account-review.md)
- [x] [TASK-012: UI Filters And Regression Hardening](file:///ai/tasks/TASK-012-ui-filters-and-regression-hardening.md)

## 4. Verification

- `uv run pytest tests/test_internal_transfers.py tests/test_commitments.py tests/test_decisions.py`
- `cd frontend && npm run test:e2e`
