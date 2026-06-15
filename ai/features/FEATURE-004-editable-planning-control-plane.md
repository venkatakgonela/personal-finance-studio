<!---
ai-eos-metadata:
  purpose: "Feature record for editable goals, budget, settings, import center, and planning controls."
  how_to_use: "Use when changing Phase 1.75 planning preferences or local-first editable controls."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-004: Editable Planning Control Plane

**Epic:** [EPIC-002: Planning And Reporting Depth](file:///ai/epics/EPIC-002-planning-and-reporting-depth.md)  
**Status:** Complete locally  

## 1. Description & User Stories

- **Description:** Add user-authored local planning controls for goals, budgets, categories, tags,
  rules, merchant preferences, import management, dashboard planning snapshots, and cashflow cards.
- **As a** household finance user **I want to** edit plans while preserving imported facts **so that**
  planning values and actual money movement remain distinct.

## 2. Acceptance Criteria

- [x] Goals support local add, edit, delete, and refresh persistence.
- [x] Budget shows planned, actual, remaining, and mode-specific values.
- [x] Settings owns categories, tags, rules, merchants, data, and system controls.
- [x] Import Center owns freshness, preview, commit, and detection actions.

## 3. Source Tasks

- [x] [TASK-014: Phase 1.75 Editable Planning Control Plane](file:///ai/tasks/TASK-014-phase-1-75-editable-planning-control-plane.md)

## 4. Verification

- `cd frontend && npm run test`
- `cd frontend && npm run test:e2e`
