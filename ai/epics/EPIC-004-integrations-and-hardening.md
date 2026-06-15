<!---
ai-eos-metadata:
  purpose: "Epic record for future integrations, reliability, security, and packaging work."
  how_to_use: "Use before planning Phase 3 or production-hardening changes."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# EPIC-004: Integrations And Hardening

**Status:** Not Started  
**Owner:** Kiran Gonela  
**Roadmap source:** [Phase 3 - Integrations](file:///ai/roadmap/ROADMAP.md)

## 1. Description

Evaluate optional Open Banking, sync health, backup/restore, longer-range planning, packaging, and
advanced reliability controls after the local-first household and business foundations are stable.

## 2. Included Features

- [ ] [FEATURE-009: Open Banking And Sync Evaluation](file:///ai/features/FEATURE-009-open-banking-and-sync-evaluation.md)
- [ ] [FEATURE-010: FreeAgent Bank Data Fetch](file:///ai/features/FEATURE-010-freeagent-bank-data-fetch.md)

## 3. Source Artifacts

- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Observability](file:///ai/07-observability.md)
- [Risk Register](file:///ai/08-risk-register.md)
- [Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md)
- [SPEC-004: FreeAgent Bank Data Fetch](file:///ai/specs/SPEC-004-freeagent-bank-data-fetch.md)

## 4. Guardrails

- Keep Open Banking optional and explicitly approved.
- Keep FreeAgent integration read-only until explicit import/commit approval.
- Preserve local-first privacy defaults.
- Add observability and auditability before expanding automated data flows.
