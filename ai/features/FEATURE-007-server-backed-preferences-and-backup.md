<!---
ai-eos-metadata:
  purpose: "Feature record for planned server-backed preferences and local backup/restore."
  how_to_use: "Use when promoting browser-local preferences to durable backend persistence."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-007: Server-Backed Preferences And Backup

**Epic:** [EPIC-003: Business And Assistant Expansion](file:///ai/epics/EPIC-003-business-and-assistant-expansion.md)  
**Status:** Not Started  

## 1. Description & User Stories

- **Description:** Persist goals, budgets, rules, merchant preferences, tags, and backup/restore
  controls beyond browser-local storage.
- **As a** local-first user **I want to** keep planning preferences durable and portable **so that**
  browser storage loss does not erase my planning setup.

## 2. Acceptance Criteria

- [ ] Settings/preferences have backend models, migrations, APIs, and tests.
- [ ] Backup/restore exports include user-authored preferences.
- [ ] Imported facts remain distinct from user-authored planning preferences.
- [ ] Existing browser-local behavior migrates or degrades gracefully.

## 3. Source Artifacts

- [ADR-014: Local-First Editable Planning Preferences](file:///ai/04-decisions.md)
- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Risk Register](file:///ai/08-risk-register.md)
