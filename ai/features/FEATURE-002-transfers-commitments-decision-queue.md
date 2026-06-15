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
  candidates to a human review queue, and keep spending/income calculations from being inflated.
- **As a** household finance user **I want to** confirm transfers and recurring bills **so that** the
  app can produce trustworthy reports and forecasts.

## 2. Acceptance Criteria

- [x] Internal transfer candidates are detected and can be confirmed or rejected.
- [x] Recurring commitment candidates are detected and can be reviewed.
- [x] Transfers are first-class records, not category hacks.
- [x] Decision Queue stays focused on high-impact review items.

## 3. Source Tasks

- [x] [TASK-006: Internal Transfer Detection](file:///ai/tasks/TASK-006-internal-transfer-detection.md)
- [x] [TASK-009: Recurring Commitment Candidates](file:///ai/tasks/TASK-009-recurring-commitment-candidates.md)
- [x] [TASK-010: Dashboard Calendar Account Review](file:///ai/tasks/TASK-010-dashboard-calendar-account-review.md)
- [x] [TASK-012: UI Filters And Regression Hardening](file:///ai/tasks/TASK-012-ui-filters-and-regression-hardening.md)

## 4. Verification

- `uv run pytest tests/test_internal_transfers.py tests/test_commitments.py tests/test_decisions.py`
- `cd frontend && npm run test:e2e`
