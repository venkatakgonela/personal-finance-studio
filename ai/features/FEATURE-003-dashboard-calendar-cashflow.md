<!---
ai-eos-metadata:
  purpose: "Feature record for dashboard, calendar, forecast, and cashflow planning views."
  how_to_use: "Use when changing cash position, selected date windows, calendar, or forecast behavior."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-003: Dashboard, Calendar, And Cash Flow

**Epic:** [EPIC-001: Household Control Center](file:///ai/epics/EPIC-001-household-control-center.md)  
**Status:** Complete locally  

## 1. Description & User Stories

- **Description:** Show cash position, upcoming or recent bills, forecast pressure, flexible spend,
  calendar commitments, and review actions by selected date window.
- **As a** household finance user **I want to** understand what money exists and what is committed
  **so that** I can avoid cash crunches and make informed spending decisions.

## 2. Acceptance Criteria

- [x] Dashboard separates balances, selected-period activity, planning risk, and review actions.
- [x] Calendar displays dated commitments and candidate inclusion controls.
- [x] Cash Flow distinguishes starting cash, ending cash, lowest point, confirmed due, and candidate due.
- [x] Actual, estimated, forecast, and pending values use clear semantics.

## 3. Source Tasks

- [x] [TASK-010: Dashboard Calendar Account Review](file:///ai/tasks/TASK-010-dashboard-calendar-account-review.md)
- [x] [TASK-011: Phase 1 Completion](file:///ai/tasks/TASK-011-phase-1-completion.md)
- [x] [TASK-013: Phase 1.5 Planning Depth](file:///ai/tasks/TASK-013-phase-1-5-planning-depth.md)

## 4. Verification

- `uv run pytest tests/test_dashboard_calendar.py tests/test_phase1_completion.py`
- `cd frontend && npm run test:e2e`
