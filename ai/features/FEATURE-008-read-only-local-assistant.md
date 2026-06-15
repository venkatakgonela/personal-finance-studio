<!---
ai-eos-metadata:
  purpose: "Feature record for the planned read-only local assistant."
  how_to_use: "Use when planning assistant architecture, safety, and evaluation."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-008: Read-Only Local Assistant

**Epic:** [EPIC-003: Business And Assistant Expansion](file:///ai/epics/EPIC-003-business-and-assistant-expansion.md)  
**Status:** Not Started  

## 1. Description & User Stories

- **Description:** Add a read-only local assistant that explains deterministic app results, cites
  source rows or reports, and helps navigate next actions without mutating finance data.
- **As a** user **I want to** ask questions about my finance data **so that** I can understand app
  results without trusting an LLM to calculate money.

## 2. Acceptance Criteria

- [ ] Assistant answers use deterministic app queries and cite app evidence.
- [ ] Assistant cannot mutate imports, transactions, decisions, rules, or preferences.
- [ ] Assistant logs prompts/results enough for auditability.
- [ ] Evals cover hallucinated finance claims and missing citations.

## 3. Source Artifacts

- [ADR-007: Keep LLM Assistant Out Of Phase 1 Core](file:///ai/04-decisions.md)
- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Risk Register](file:///ai/08-risk-register.md)
