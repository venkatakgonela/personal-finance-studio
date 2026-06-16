# AGENTS.md - AI Agent Guidelines

**Project:** Personal Finance Studio  
**Type:** Local-first finance app  
**Owner:** Kiran Gonela

## Mandatory Rules

- Read this file before editing the repository.
- Read the relevant files in `ai/` before implementation.
- Do not implement app code until the user explicitly asks to start implementation.
- Keep Household and Business financial data entity-scoped by default.
- Do not mix personal and business finance views unless a deliberate combined view is specified.
- Do not add Open Banking, LLM assistant, cloud sync, or mobile scope unless explicitly approved.
- Preserve user privacy: imported CSV files should be parsed and discarded unless a spec says otherwise.
- Before future commits, run the documented backend and frontend checks once implementation exists.

## Core Context

- Default context policy: `ai/context-packs/context-pack-default.md`
- Repo map: `ai/03-repo-map.md`
- Architecture: `ai/01-architecture.md`
- Domain model: `ai/02-domain-model.md`
- Decisions: `ai/04-decisions.md`
- Roadmap: `ai/roadmap/ROADMAP.md`
- Testing strategy: `ai/specs/SPEC-003-testing-strategy.md`
- Load specialized context packs only when relevant:
  `ai/context-packs/context-pack-backend-data.md`,
  `ai/context-packs/context-pack-frontend-ui.md`,
  `ai/context-packs/context-pack-product-planning.md`,
  `ai/context-packs/context-pack-freeagent-api.md`, or
  `ai/context-packs/context-pack-phase-2-1.md`.

## Delivery Boundary

Current mode is iterative local implementation and stabilization. For future work, do not implement
app code until the user explicitly asks to build, fix, update, or continue a feature. When work is
approved, load the smallest relevant context pack, make the smallest coherent change, and run the
documented quality gate that matches the touched surface.
