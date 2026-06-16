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
| ADR-012 | Persist view state in the hash URL | Accepted | 2026-06-14 |
| ADR-013 | De-duplicate in-flight frontend GET requests | Accepted | 2026-06-14 |
| ADR-014 | Use local-first editable planning preferences for Phase 1.75 | Accepted | 2026-06-15 |
| ADR-015 | Split Phase 2 household expansion from Phase 2.1 business and assistant work | Accepted | 2026-06-15 |
| ADR-016 | Move dense finance explanations into contextual help tooltips | Accepted | 2026-06-15 |
| ADR-017 | Model overdraft capacity separately from liabilities | Accepted | 2026-06-15 |
| ADR-018 | Implement FreeAgent as read-only manual-token integration first | Accepted | 2026-06-15 |
| ADR-019 | Keep dashboard fact-led and move assumption editing to Budget | Accepted | 2026-06-15 |
| ADR-020 | Use library-backed dashboard sorting and lightweight transitions | Accepted | 2026-06-15 |
| ADR-021 | Redesign Budget as a decision-first control tower | Accepted | 2026-06-15 |
| ADR-022 | Use a commitment inbox with transaction-backed, manual, and finite commitment support | Accepted | 2026-06-15 |
| ADR-023 | Fetch complete FreeAgent history before recurring detection | Accepted | 2026-06-15 |
| ADR-024 | Separate recurring reference labels from source evidence | Accepted | 2026-06-16 |

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

## ADR-012 - Persist View State in the Hash URL

- **Status**: Accepted
- **Context**: Refreshing the app reset date windows, filters, report selections, and search state, which made the local app feel unreliable during review.
- **Decision**: Store refresh-worthy UI state in the hash URL: route, date range, custom dates, search, include-candidates, transaction filters, Reports tab, and Reports grouping.
- **Consequences**: Browser refresh preserves context and reloads values rather than resetting the view. URLs are more shareable/debuggable, but route/query handling must stay synchronized with component state.

## ADR-013 - De-duplicate In-Flight Frontend GET Requests

- **Status**: Accepted
- **Context**: React dev StrictMode intentionally replays effects, which doubled local API traffic during refresh and made the app feel slower in development.
- **Decision**: De-duplicate identical in-flight GET requests in `frontend/src/api.ts` while leaving mutating requests untouched.
- **Consequences**: Local dev refreshes avoid duplicate backend work without disabling StrictMode. This is not a full cache; fresh values still load after each request settles.

## ADR-014 - Use Local-First Editable Planning Preferences for Phase 1.75

- **Status**: Accepted
- **Context**: Phase 1.5 derives goals, review items, and reports from imported data, but the app now
  needs user-authored planning controls before committing to new server tables and migrations for
  every product concept.
- **Decision**: Store Phase 1.75 custom goals, budget plans, category/tag/rule preferences, and
  merchant display settings in browser local storage as a local-first bridge. Backend-derived
  accounts, transactions, commitments, insights, and dashboard totals remain the source of truth for
  actual money movement.
- **Consequences**: The UI can validate real workflows quickly and preserve edits across refresh.
  These settings are local to the browser until Phase 2 promotes them to API-backed persistence.
  Budget actuals and report totals must continue to be calculated from imported data, not manually
  entered preference data.

## ADR-015 - Split Phase 2 Household Expansion From Phase 2.1 Business and Assistant Work

- **Status**: Accepted
- **Context**: The roadmap now contains two different kinds of expansion: household planning depth
  and separate Business/assistant capabilities. Combining them would make the next milestone too
  broad and would risk disturbing the now-stable household UI.
- **Decision**: Phase 2 focuses on household-facing expansion: rule preview/apply/undo, merchant
  aliases/merge/split, cashflow scenarios, budget modes, spending plan, and exports. Phase 2.1 owns
  Business entity UI/import lanes and the read-only local assistant.
- **Consequences**: Household controls can mature first while Business and LLM work remain cleanly
  isolated. Phase 2 implementation must keep current UI rhythm and avoid cross-entity data mixing.

## ADR-016 - Move Dense Finance Explanations Into Contextual Help Tooltips

- **Status**: Accepted
- **Context**: Dashboard and planning cards became more accurate but also more verbose as labels
  explained whether values were balances, selected-period activity, candidates, forecasts, or review
  quality signals.
- **Decision**: Use a shared contextual help tooltip pattern for card headers and key metric labels.
  Keep visible card copy concise, and move definitions/assumptions into `?` help controls that work
  on hover and keyboard focus.
- **Consequences**: Screens stay calmer and less crowded while still explaining finance semantics.
  Tooltip buttons must use neutral accessible names so they do not interfere with form labels or
  action buttons, and tooltip stacking/placement becomes part of the design-system regression scope.

## ADR-017 - Model Overdraft Capacity Separately From Liabilities

- **Status**: Accepted
- **Context**: UK current accounts can have authorized overdrafts. A negative balance is a liability, but the unused overdraft can still be available capacity for bill payments. Treating the negative balance as purely unavailable understated short-term payment capacity; treating it as cash ignored liability.
- **Decision**: Add `accounts.overdraft_limit` and centralize account math in `app/services/account_balances.py`. `available_for_bills = max(current_balance + overdraft_limit, 0)` for cash-style accounts, while `liability_balance` remains the absolute negative balance. Credit cards, loans, and BNPL remain liabilities and do not contribute bill-payment capacity.
- **Consequences**: Dashboard Cash Position and planning goals can use available capacity without hiding debt. Accounts UI must show both "Available" and "Liability" so the user sees the tradeoff.

## ADR-018 - Implement FreeAgent As Read-Only Manual-Token Integration First

- **Status**: Accepted
- **Context**: FreeAgent provides bank accounts and bank transactions through OAuth, but full browser callback/token exchange adds extra security and UX complexity. The user can validate the API using Postman/OAuth Playground first.
- **Decision**: Implement a read-only manual-token phase: encrypted local credential storage, status/validation endpoints, bank account listing, selected-account date-range import, incremental cursor support, provider-tagged transaction dedupe, and production/sandbox/custom API modes. Do not upload, delete, or mutate FreeAgent data.
- **Consequences**: The app can ingest live FreeAgent bank data now while preserving a safe boundary. Refresh token is optional and distinct from access token. Full OAuth callback, token refresh UX, and import preview remain future hardening work.

## ADR-019 - Keep Dashboard Fact-Led And Move Assumption Editing To Budget

- **Status**: Accepted
- **Context**: The Spending Plan card initially exposed many planning assumptions directly on Dashboard. That made the Dashboard a workbench, consumed prime real estate, and risked confusing cash facts with planning scenarios.
- **Decision**: Dashboard shows fact-led summaries only: Cash Position, Safe to Spend, period surplus evidence, bills, activity, review, and risk. Assumption editing for income changes, one-off exclusions, lifestyle allowance, known costs, safety buffer, and lookback baseline lives on Budget.
- **Consequences**: Dashboard remains calm and decision-oriented. Budget owns scenario/assumption work. Safe to Spend is cash-capped and should never imply that period surplus is immediately spendable.

## ADR-020 - Use Library-Backed Dashboard Sorting And Lightweight Transitions

- **Status**: Accepted
- **Context**: A hand-rolled widget drag system was functional but not smooth enough for a dashboard. Large, uneven cards caused visual smearing and unpredictable reorder behavior.
- **Decision**: Use `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` for dashboard widget sorting with `DragOverlay`, keyboard/pointer sensors, always-on measuring, and grid swap behavior. Use `@formkit/auto-animate` for small list/collapsible transitions. Do not adopt heavy UI/chart libraries until a route requires a broader rewrite.
- **Consequences**: Dashboard personalization has smoother motion, better accessibility, and less custom drag code. Bundle size increases modestly. Performance and regressions must be checked with browser smoke tests for overlay presence, reorder completion, and overflow.

## ADR-021 - Redesign Budget As A Decision-First Control Tower

- **Status**: Accepted
- **Context**: The Budget page combined setup, actuals, safe-spend assumptions, rollover math, category planning, and review in one dense vertical screen. It was accurate but cognitively heavy, encouraging spreadsheet-style interpretation rather than calm financial decisions.
- **Decision**: Reframe Budget around a five-panel control-tower workflow: Overview, Monthly plan, Envelopes, Assumptions, and Review. Use Kakeibo-style reflection ("what do I have, what must be protected, what can I spend, what should improve"), envelope budgeting, guardrail budgeting, pay-yourself-first, and mental accounting principles. Keep Dashboard fact-led while Budget owns the reasoning and edits.
- **Consequences**: Users see the spend boundary before the editable table. Detailed controls remain available but no longer crowd the first view. Regression tests must verify every tab, label, action, and responsive layout because hidden panels can otherwise drift out of sync.

## ADR-022 - Use A Commitment Inbox With Transaction-Backed, Manual, And Finite Commitment Support

- **Status**: Accepted
- **Context**: Pattern detection cannot find every real bill, especially new commitments, annual payments with sparse history, cash/manual obligations, or user-known bills that have not appeared in imported data. Some obligations, such as BNPL and short payment plans, recur only for a fixed period and should not become permanent forecast noise.
- **Decision**: Treat recurring as a commitment inbox. Detection proposes candidates, users can create a commitment from a real outflow transaction as source evidence, and users can manually add confirmed commitments when no transaction exists. Commitments may be ongoing, end on a known date, or stop after a fixed number of payments. BNPL is modeled as a first-class commitment type with finite payment support.
- **Consequences**: Forecasts and calendars are more complete even when detection misses a bill. Transaction-backed creation is preferred over blank manual entry because it preserves an imported evidence trail. Short-term obligations stop polluting long-term planning. The UI must clearly explain that saved commitments feed Calendar, Cash Flow, Budget, and Dashboard immediately.

## ADR-023 - Fetch Complete FreeAgent History Before Recurring Detection

- **Status**: Accepted
- **Context**: Recurring bill detection depends on multiple months of transaction evidence. FreeAgent bank transaction responses can be paginated; importing only the first response page leaves the app with a short window and causes detection to return no candidates even when real bills exist.
- **Decision**: The FreeAgent client must follow paginated `rel="next"` links until complete, then persist provider-tagged rows idempotently. The durable OAuth path is authorization-code exchange, encrypted refresh-token storage, and automatic access-token refresh on expiry.
- **Consequences**: First-run date-range imports provide enough history for bill/subscription/loan pattern detection. Users still may paste manual tokens for testing, but production-like usage should exchange an authorization code once so refresh tokens are stored securely.

## ADR-024 - Separate Recurring Reference Labels From Source Evidence

- **Status**: Accepted
- **Context**: Imported transaction labels often contain noisy provider text, punctuation, card-network fragments, or vendor-specific descriptions. Those labels are valuable as evidence, but poor as the household's planning vocabulary.
- **Decision**: Store editable `name` and `category` fields on commitments, plus immutable-ish `source_label` evidence from the imported transaction where available. Transaction-backed commitments keep the source transaction link while allowing a user-friendly reference name, household category, planning amount, type, frequency, and next due date. Category inference uses household-planning labels instead of broad bank labels: Credit cards, Vehicle loan/insurance/maintenance/tax, Utilities, Telecoms, Council tax, Kids tuition & school fees, Education & childcare, Family support, Healthcare, BNPL / pay later, Subscriptions, and Annual / irregular costs.
- **Consequences**: Calendar, Cash Flow, Budget, Dashboard, Sinking Funds, and Subscriptions can use meaningful household labels while preserving auditability. Migration `20260615_0006_add_commitment_category.py` backfills existing commitments to `Bills`; migration `20260616_0007_add_commitment_source_label.py` adds raw source-label evidence for new/updated commitments. Legacy detected/transaction commitments without the column populated expose their current bank label as source evidence and freeze it on first rename. Users can dismiss non-recurring transaction advice locally so the inbox stays calm without mutating imported transactions.
