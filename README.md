# Personal Finance Studio

Personal Finance Studio is a local-first Household and Business Finance Control Center.

The first release focuses on the Household entity using Snoop CSV imports. It helps answer:

- What money exists right now?
- What is already committed?
- What is flexible and safe to spend?
- What bills, credit cards, loans, and BNPL payments are due next?
- What will balances look like on a selected future date?

This repository is currently in planning-first mode. Implementation should start only after the Phase 1 specification and ADRs are reviewed.

## Planning Docs

- [Project Charter](ai/00-project-charter.md)
- [Architecture](ai/01-architecture.md)
- [Domain Model](ai/02-domain-model.md)
- [Decisions / ADRs](ai/04-decisions.md)
- [Roadmap](ai/roadmap/ROADMAP.md)
- [Phase 1 Specification](ai/specs/SPEC-001-phase-1-household-snoop.md)
- [Screen & Design Specification](ai/specs/SPEC-002-screen-and-design-system.md)

## Locked Direction

- Frontend: React + Vite + TypeScript
- Backend: FastAPI + Python
- Database: PostgreSQL
- Phase 1 integration: Snoop CSV import
- Phase 1 entity: Household
- Future entities/integrations: Business, Tide CSV, NatWest Business CSV, Open Banking, local LLM assistant
