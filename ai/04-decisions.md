<!---
ai-eos-metadata:
  purpose: "Architecture Decision Records and design choices."
  how_to_use: "Consult to understand why decisions were made; append new ADRs here."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Architecture Decisions - Personal Finance Studio

## Decision Log

| ID | Title | Status | Date |
|---|---|---|---|
| ADR-001 | Use entity-scoped Household and Business model | Accepted | 2026-06-14 |
| ADR-002 | Start with Snoop CSV before Open Banking | Accepted | 2026-06-14 |
| ADR-003 | Use React + Vite, FastAPI, PostgreSQL | Accepted | 2026-06-14 |
| ADR-004 | Treat internal transfer detection as a first-class pipeline | Accepted | 2026-06-14 |
| ADR-005 | Separate actual, estimated, forecast, and pending values visually | Accepted | 2026-06-14 |
| ADR-006 | Reserve Goals and annual sinking-fund support in the data model | Accepted | 2026-06-14 |
| ADR-007 | Keep LLM assistant out of Phase 1 core | Accepted | 2026-06-14 |
| ADR-008 | Make testing a first-class Phase 1 deliverable | Accepted | 2026-06-14 |

## ADR-001 - Use Entity-Scoped Household and Business Model

- **Status**: Accepted
- **Context**: Household and Business finances have different accounts, categories, reporting, tax meaning, and privacy boundaries.
- **Decision**: Add `entities` above profiles. Every financial object is scoped to exactly one entity.
- **Consequences**: Prevents personal/business cross-contamination. Enables future Business support without redesigning the model.

## ADR-002 - Start With Snoop CSV Before Open Banking

- **Status**: Accepted
- **Context**: Open Banking adds consent flows, provider complexity, refresh constraints, and security scope.
- **Decision**: Phase 1 imports Snoop CSV data manually. Open Banking remains a later integration.
- **Consequences**: Faster local validation with real data. Requires import freshness indicators and manual import discipline.

## ADR-003 - Use React + Vite, FastAPI, PostgreSQL

- **Status**: Accepted
- **Context**: The app needs a polished local UI, deterministic finance logic, durable relational storage, and future integration readiness.
- **Decision**: Use React + Vite + TypeScript frontend, FastAPI backend, PostgreSQL database.
- **Consequences**: Strong developer ergonomics and data integrity. Docker Compose recommended for local Postgres.

## ADR-004 - Treat Internal Transfer Detection as a First-Class Pipeline

- **Status**: Accepted
- **Context**: Real Snoop data contains many transfers between HSBC, Barclays, Lloyds, credit cards, savings, and self-bills movements.
- **Decision**: Build internal transfer detection before dashboard/insights calculations.
- **Consequences**: Avoids inflated spending/income. Adds review complexity, but makes dashboard trustable earlier.

## ADR-005 - Separate Actual, Estimated, Forecast, and Pending Values Visually

- **Status**: Accepted
- **Context**: The product mixes real balances, estimated bills, future forecasts, and pending transactions.
- **Decision**: Define a data-confidence visual language in the design system.
- **Consequences**: Reduces confusion and improves trust. Requires consistent UI components.

## ADR-006 - Reserve Goals and Annual Sinking-Fund Support

- **Status**: Accepted
- **Context**: Monarch-style goals, annual costs, and non-monthly expenses add real planning value.
- **Decision**: Add goals-ready schema and support `annual`, `custom`, and `one_off` commitment frequencies from Phase 1.
- **Consequences**: Avoids schema retrofit. Full Goals UI can wait until Phase 2.

## ADR-007 - Keep LLM Assistant Out of Phase 1 Core

- **Status**: Accepted
- **Context**: A local LLM assistant can answer questions, but finance calculations must be deterministic first.
- **Decision**: Do not build LLM assistant in Phase 1. Reserve architecture for later read-only, query-backed assistant.
- **Consequences**: Phase 1 remains reliable. Future assistant can explain app-computed results instead of guessing.

## ADR-008 - Make Testing a First-Class Phase 1 Deliverable

- **Status**: Accepted
- **Context**: Personal finance software can look correct while producing wrong balances, duplicated transactions, inflated spending, or misleading forecasts.
- **Decision**: Phase 1 must include backend unit/integration tests, deterministic finance calculation tests, import fixture tests, API tests, and browser end-to-end tests for core user flows.
- **Consequences**: Slower initial build, but higher trust. Browser testing becomes part of the release gate rather than a final manual check.
