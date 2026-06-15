<!---
ai-eos-metadata:
  purpose: "Feature record for Phase 2 household expansion workflows."
  how_to_use: "Use when changing rules, merchant cleanup, report grouping, scenarios, budget modes, or exports."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-005: Rules, Merchants, Reports, And Exports

**Epic:** [EPIC-002: Planning And Reporting Depth](file:///ai/epics/EPIC-002-planning-and-reporting-depth.md)  
**Status:** Complete locally  

## 1. Description & User Stories

- **Description:** Add rule preview/apply/undo, merchant alias/merge/split controls, cashflow
  scenarios, flexible and rollover budgets, spending plan, contextual help, and CSV exports.
- **As a** household finance user **I want to** clean and export reports without losing raw imported
  evidence **so that** reporting becomes useful and auditable.

## 2. Acceptance Criteria

- [x] Rule application is previewed before commit and can be undone locally.
- [x] Merchant cleanup affects display/report labels without mutating raw imported text.
- [x] Cashflow scenarios compare baseline and what-if outcomes.
- [x] Reports and exports honor selected filters/date windows where applicable.

## 3. Source Tasks

- [x] [TASK-015: Phase 2 Household Expansion](file:///ai/tasks/TASK-015-phase-2-household-expansion.md)

## 4. Verification

- `uv run pytest tests/test_phase2_household_expansion.py`
- `cd frontend && npm run test:e2e`
