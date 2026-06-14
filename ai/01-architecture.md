<!---
ai-eos-metadata:
  purpose: "High-level architecture design, component relationships, and data flows."
  how_to_use: "Consult before implementing features to ensure structural alignment."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Architecture Design - Personal Finance Studio

## 1. System Overview

Personal Finance Studio is planned as a local-first web application:

- React + Vite frontend for the user interface.
- FastAPI backend for import, finance logic, forecasts, and APIs.
- PostgreSQL database for durable local storage.
- Docker Compose for local development and database runtime.

Phase 1 has one active entity, Household, populated by Snoop CSV imports. The architecture must remain ready for Business entity imports from Tide/NatWest Business later.

## 2. Key Components

- **Frontend App**: React, TypeScript, route-based screens, design system, charts, tables, calendar/timeline views.
- **Backend API**: FastAPI endpoints for imports, accounts, transactions, categories, commitments, forecasts, dashboards, and decisions.
- **Import Service**: Snoop CSV parser, validator, previewer, fingerprinting/upsert engine, import logs.
- **Classification Service**: account type mapping, category normalization, merchant rules, reviewed/unreviewed state.
- **Internal Transfer Engine**: same/similar amount matching, opposite-sign reconciliation, description/account pattern detection.
- **Commitment Engine**: recurring bill detection, subscription candidates, variable bill estimates, BNPL/loan/credit-card obligation modeling.
- **Forecast Engine**: projected balances, available-after-commitments, flexible spending remaining, low-balance warnings.
- **Decision Queue**: low-noise human confirmations that improve accuracy.
- **Database**: PostgreSQL tables for entities, profiles, accounts, transactions, rules, bills, instances, imports, goals-ready schema.

## 3. Data Flow

```mermaid
graph TD
    CSV[Snoop CSV] --> Preview[Import Preview]
    Preview --> Import[Import Service]
    Import --> Dedupe[Fingerprint / Upsert]
    Dedupe --> DB[(PostgreSQL)]
    DB --> Transfer[Internal Transfer Engine]
    DB --> Rules[Category / Merchant Rules]
    DB --> Recurring[Recurring Commitment Detection]
    Transfer --> Decisions[Decision Queue]
    Rules --> Decisions
    Recurring --> Decisions
    DB --> Forecast[Forecast Engine]
    Forecast --> API[FastAPI]
    DB --> API
    API --> UI[React App]
```

## 4. Key Constraints & Tech Stack

- **Frontend**: React + Vite + TypeScript.
- **Routing**: Lightweight hash routes for Phase 1 (`#/dashboard`, `#/accounts`, etc.); upgrade to a router library only when nested flows need it.
- **Data Fetching**: TanStack Query.
- **Styling**: Tailwind CSS with project design tokens.
- **Charts**: Recharts or Visx.
- **Backend**: FastAPI, Pydantic, SQLAlchemy, Alembic.
- **Database**: PostgreSQL.
- **Runtime**: Docker Compose for Postgres; local backend/frontend dev servers.
- **Phase 1 Integration**: Snoop CSV only.

## 5. Architecture Principles

- Entity scope is mandatory: Household and Business data must not cross-contaminate.
- App calculations are deterministic; future LLM features may explain results but should not calculate money.
- Imported files are parsed and discarded by default; import logs and normalized records are retained.
- Transfers are first-class records, not category hacks.
- Forecasts must distinguish actual, estimated, forecast, and pending values.
