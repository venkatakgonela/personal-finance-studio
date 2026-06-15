<!---
ai-eos-metadata:
  purpose: "Epic record for the completed household control center foundation."
  how_to_use: "Use when reasoning about Phase 1 scope, completed foundations, or regression risk."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# EPIC-001: Household Control Center

**Status:** Complete locally  
**Owner:** Kiran Gonela  
**Roadmap source:** [Phase 1 - Household Control Center](file:///ai/roadmap/ROADMAP.md)

## 1. Description

Build the local-first household finance foundation: Snoop CSV import, account/transaction storage,
transfer detection, recurring commitment detection, calendar/upcoming bills, forecast, dashboard,
Decision Queue, and basic reports.

This epic is complete locally and should be treated as the baseline behavior future work must not
regress.

## 2. Included Features

- [x] [FEATURE-001: Snoop Import And Transaction Foundation](file:///ai/features/FEATURE-001-snoop-import-and-transaction-foundation.md)
- [x] [FEATURE-002: Transfers, Commitments, And Decision Queue](file:///ai/features/FEATURE-002-transfers-commitments-decision-queue.md)
- [x] [FEATURE-003: Dashboard, Calendar, And Cash Flow](file:///ai/features/FEATURE-003-dashboard-calendar-cashflow.md)

## 3. Source Artifacts

- [Project Charter](file:///ai/00-project-charter.md)
- [Architecture](file:///ai/01-architecture.md)
- [Domain Model](file:///ai/02-domain-model.md)
- [SPEC-001: Phase 1 Household Snoop](file:///ai/specs/SPEC-001-phase-1-household-snoop.md)
- [SPEC-003: Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md)
- [TASK-004: Bootstrap Implementation Foundation](file:///ai/tasks/TASK-004-bootstrap-implementation-foundation.md)
- [TASK-011: Phase 1 Completion](file:///ai/tasks/TASK-011-phase-1-completion.md)

## 4. Verification Anchors

- `uv run pytest`
- `cd frontend && npm run test:e2e`
- Finance calculations remain deterministic and GBP-only for household views.
