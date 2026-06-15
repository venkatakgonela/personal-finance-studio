<!---
ai-eos-metadata:
  purpose: "Epic record for next-phase Business entity and read-only assistant expansion."
  how_to_use: "Use before planning or implementing Phase 2.1 work."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# EPIC-003: Business And Assistant Expansion

**Status:** Not Started  
**Owner:** Kiran Gonela  
**Roadmap source:** [Phase 2.1 - Business And Assistant Expansion](file:///ai/roadmap/ROADMAP.md)

## 1. Description

Add true Business entity support and a read-only local assistant without weakening the household
foundation. Business work must isolate data, imports, categories, reports, and exports from
Household. Assistant work must use deterministic app queries and cite app evidence rather than
calculating money directly.

## 2. Included Features

- [ ] [FEATURE-006: Business Entity Imports And Isolation](file:///ai/features/FEATURE-006-business-entity-imports-and-isolation.md)
- [ ] [FEATURE-007: Server-Backed Preferences And Backup](file:///ai/features/FEATURE-007-server-backed-preferences-and-backup.md)
- [ ] [FEATURE-008: Read-Only Local Assistant](file:///ai/features/FEATURE-008-read-only-local-assistant.md)

## 3. Source Artifacts

- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Architecture Decisions](file:///ai/04-decisions.md)
- [Domain Model](file:///ai/02-domain-model.md)
- [Risk Register](file:///ai/08-risk-register.md)
- [Context Pack: Phase 2.1](file:///ai/context-packs/context-pack-phase-2-1.md)

## 4. Guardrails

- No automatic personal/business data mixing.
- No assistant mutations until explicit approval and audit logging exist.
- Imported raw CSV files remain private and should not be committed.
