<!---
ai-eos-metadata:
  purpose: "Task-scoped context pack for upcoming Phase 2.1 Business and assistant work."
  how_to_use: "Load before planning or implementing Business entity, preference persistence, or assistant changes."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# Context Pack: Phase 2.1 Business And Assistant

## 1. Required Context

- [AGENTS.md](file:///AGENTS.md)
- [EPIC-003: Business And Assistant Expansion](file:///ai/epics/EPIC-003-business-and-assistant-expansion.md)
- [FEATURE-006: Business Entity Imports And Isolation](file:///ai/features/FEATURE-006-business-entity-imports-and-isolation.md)
- [FEATURE-007: Server-Backed Preferences And Backup](file:///ai/features/FEATURE-007-server-backed-preferences-and-backup.md)
- [FEATURE-008: Read-Only Local Assistant](file:///ai/features/FEATURE-008-read-only-local-assistant.md)

## 2. Add When Relevant

- [Domain Model](file:///ai/02-domain-model.md) for entity scoping and financial objects.
- [Architecture Decisions](file:///ai/04-decisions.md) for local-first preferences, assistant deferral, and entity boundaries.
- [New Enhancements Backlog](file:///ai/new-enhancements.md) for ranked missing pieces.
- [Risk Register](file:///ai/08-risk-register.md) for business-data mixing and assistant accuracy risks.
- [Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md) for new regression coverage.

## 3. Guardrails

- Household and Business data must not cross-contaminate.
- Assistant work is read-only first and must cite deterministic app evidence.
- Server-backed preferences must preserve the distinction between imported facts and user-authored plans.
