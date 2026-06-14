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

- Charter: `ai/00-project-charter.md`
- Architecture: `ai/01-architecture.md`
- Domain model: `ai/02-domain-model.md`
- Decisions: `ai/04-decisions.md`
- Roadmap: `ai/roadmap/ROADMAP.md`
- Phase 1 spec: `ai/specs/SPEC-001-phase-1-household-snoop.md`
- Design spec: `ai/specs/SPEC-002-screen-and-design-system.md`

## Planning Boundary

Current mode is documentation and planning. Implementation begins only when the user explicitly says to build.
