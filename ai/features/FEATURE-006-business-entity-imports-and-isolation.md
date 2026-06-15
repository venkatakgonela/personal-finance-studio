<!---
ai-eos-metadata:
  purpose: "Feature record for planned Business entity isolation and import lanes."
  how_to_use: "Use when planning Phase 2.1 Business work."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-006: Business Entity Imports And Isolation

**Epic:** [EPIC-003: Business And Assistant Expansion](file:///ai/epics/EPIC-003-business-and-assistant-expansion.md)  
**Status:** Not Started  

## 1. Description & User Stories

- **Description:** Implement real Business entity scoping with separate dashboards, categories,
  ledgers, imports, reports, and exports for Tide and NatWest Business CSV data.
- **As a** user managing household and business money **I want to** keep those datasets isolated
  **so that** reporting, privacy, and decision-making remain correct.

## 2. Acceptance Criteria

- [ ] Every financial object remains scoped to exactly one entity.
- [ ] Business import lanes do not alter Household reports.
- [ ] UI context switcher reflects real backend scoping, not only a shell.
- [ ] Tests prove Household and Business data cannot cross-contaminate.

## 3. Source Artifacts

- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Domain Model](file:///ai/02-domain-model.md)
- [Architecture Decisions](file:///ai/04-decisions.md)
