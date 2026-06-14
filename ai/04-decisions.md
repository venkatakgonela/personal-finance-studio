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
| ADR-009 | Keep Phase 1 frontend simple with typed fetch and CSS tokens | Accepted | 2026-06-14 |
| ADR-010 | E2E tests must check backend API availability | Accepted | 2026-06-14 |
| ADR-011 | Use D3 Sankey for finance-flow reports | Accepted | 2026-06-14 |

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

## ADR-009 - Keep Phase 1 Frontend Simple With Typed Fetch and CSS Tokens

- **Status**: Accepted
- **Context**: The Phase 1 app needs fast iteration, clear local behavior, and a compact codebase more than advanced client caching or a large component framework.
- **Decision**: Use a typed `fetch` client in `frontend/src/api.ts` and CSS variables/hand-authored CSS in `frontend/src/styles.css` for Phase 1.
- **Consequences**: The app remains easy to inspect and patch. TanStack Query, Tailwind, or charting libraries can be revisited when Phase 1.5 introduces deeper report drilldowns or more complex cached workflows.

## ADR-010 - E2E Tests Must Check Backend API Availability

- **Status**: Accepted
- **Context**: The UI can render while the backend is down, producing a `Failed to fetch` banner that pure frontend smoke tests miss.
- **Decision**: Playwright E2E must start/check both FastAPI on `127.0.0.1:8025` and Vite on `127.0.0.1:5175`.
- **Consequences**: Browser tests catch local-stack failures earlier. Mocked UI tests remain useful for deterministic table/filter/layout behavior, but at least one real-stack smoke test is required.

## ADR-011 - Use D3 Sankey for Finance-Flow Reports

- **Status**: Accepted
- **Context**: Hand-drawn SVG bands were fast to iterate but became hard to keep natural, flexible, and collision-free as report tabs and grouping changed.
- **Decision**: Use `d3-sankey` for Cash Flow, Spending, and Income reports while keeping the surrounding UI in React/CSS.
- **Consequences**: The report chart can adapt to category/merchant grouping and selected report tabs with a real layout engine. Styling remains application-owned: square node bars, labels inside the chart, and lightweight annotation typography are part of the design system rather than library defaults.
