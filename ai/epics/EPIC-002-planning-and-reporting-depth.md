<!---
ai-eos-metadata:
  purpose: "Epic record for completed planning, reporting, and household expansion work."
  how_to_use: "Use when changing budget, goals, reports, rules, merchants, scenarios, or exports."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# EPIC-002: Planning And Reporting Depth

**Status:** Complete locally  
**Owner:** Kiran Gonela  
**Roadmap source:** [Phases 1.5, 1.75, and 2](file:///ai/roadmap/ROADMAP.md)

## 1. Description

Expand the household foundation into a planning workspace: goals, sinking funds, monthly review,
subscription review, editable budgets, settings, import center, rules, merchant cleanup, scenarios,
spending plan, contextual help, reports, and exports.

This epic is complete locally. Future changes should preserve the existing calm UI rhythm and the
rule that actual money totals come from imported data, commitments, accounts, or explicit user plan
values.

## 2. Included Features

- [x] [FEATURE-003: Dashboard, Calendar, And Cash Flow](file:///ai/features/FEATURE-003-dashboard-calendar-cashflow.md)
- [x] [FEATURE-004: Editable Planning Control Plane](file:///ai/features/FEATURE-004-editable-planning-control-plane.md)
- [x] [FEATURE-005: Rules, Merchants, Reports, And Exports](file:///ai/features/FEATURE-005-rules-merchants-reports-exports.md)

## 3. Source Artifacts

- [PRODUCT_GUIDE](file:///ai/PRODUCT_GUIDE.md)
- [HOW_TO_USE](file:///ai/HOW_TO_USE.md)
- [SPEC-002: Screen And Design System](file:///ai/specs/SPEC-002-screen-and-design-system.md)
- [SPEC-003: Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md)
- [TASK-013: Phase 1.5 Planning Depth](file:///ai/tasks/TASK-013-phase-1-5-planning-depth.md)
- [TASK-014: Phase 1.75 Editable Planning Control Plane](file:///ai/tasks/TASK-014-phase-1-75-editable-planning-control-plane.md)
- [TASK-015: Phase 2 Household Expansion](file:///ai/tasks/TASK-015-phase-2-household-expansion.md)

## 4. Verification Anchors

- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e`
