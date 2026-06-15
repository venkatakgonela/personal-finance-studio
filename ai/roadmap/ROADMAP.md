<!---
ai-eos-metadata:
  purpose: "Strategic roadmap, release milestones, and development phases."
  how_to_use: "Consult to check feature phasing and release goals."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Roadmap - Personal Finance Studio

**Last reviewed:** 2026-06-15
**Current phase:** Phase 2 household expansion implemented locally; Phase 2.1 is next.

## Milestones

| Milestone | Description | Status |
|---|---|---|
| Phase 0 | Planning docs, ADRs, specs, task breakdown | Complete |
| Phase 1 | Household Snoop import, transactions, transfers, commitments, forecast, dashboard | Complete locally |
| Phase 1.5 | Goals foundation, monthly review, richer reports, subscription review | Complete locally |
| Phase 1.75 | Editable planning control plane: goals, budgets, taxonomy/rules, import center, richer dashboard/cashflow | Complete locally |
| Phase 2 | Rule application, merchant cleanup, scenarios, budget modes, spending plan, exports | Complete locally |
| Phase 2.1 | Business entity imports, Tide/NatWest CSV, local LLM assistant | Not Started |
| Phase 3 | Optional Open Banking, sync health, advanced planning | Not Started |

## Phase 1 - Household Control Center

- [x] Snoop CSV import with preview and deduplication.
- [x] Account detection, classification, balance review, and include/exclude rules.
- [x] Transaction ledger with reviewed/unreviewed state.
- [x] Date-window controls and transaction filters for account, group, type, review state, status, and search.
- [x] URL-hash persistence for refresh-safe date windows, search, transaction filters, report tab, and report grouping.
- [x] Internal transfer detection and reconciliation.
- [x] Category normalization and transaction review actions.
- [x] Recurring commitment detection.
- [x] Bills, bill instances, variable amounts, annual/custom frequencies.
- [x] Calendar/upcoming commitments by selected date window.
- [x] Calendar planner grid with daily planned totals, commitment chips, and collapsible bill list.
- [x] Cashflow forecast and available-after-commitments formula.
- [x] Flexible spend remaining headline number.
- [x] Low-noise Decision Queue with desktop table and mobile review-card layout.
- [x] Basic Insights and Reports route.
- [x] D3 Sankey report visualization for Cash Flow, Spending, and Income with category/merchant grouping.
- [x] Expandable Sankey spending leaves and Income source breakdown.
- [x] Backend, API, frontend unit, and browser end-to-end tests for critical flows.

## Phase 1 Completion Notes

- The local app now has React hash routes for Dashboard, Accounts, Transactions, Cash Flow, Calendar, Recurring, Goals, Sinking Funds, Monthly Review, Subscriptions, Reports, Decision Queue, and Settings.
- The backend exposes deterministic APIs for imports, accounts, transactions, transfers, commitments, calendar, forecast, dashboard, insights, and decisions.
- Playwright E2E starts/checks both the frontend and backend, including a real-stack dashboard smoke test that fails if the API is down and the UI would show `Failed to fetch`.
- Remaining Phase 1 caveat: this is locally complete, not a packaged release. Data is still local/dev-server oriented and Open Banking/cloud sync remain out of scope.

## Phase 1.5 - Planning Depth

- [x] Goals screen derived from current balances, confirmed commitments, and review coverage.
- [x] Sinking fund manager for annual, quarterly, custom, and non-monthly commitments.
- [x] Monthly review workflow with income, outflows, net position, review counts, decisions, and next actions.
- [x] Subscription review with cancellation/renegotiation/confirmation prompts.
- [x] Saved report filters and transaction drilldown links.
- [x] URL query persistence for saved transaction filter links.
- [x] Import freshness and stale recurring-commitment review UX.
- [x] Phase 1.5 backend, frontend, and browser route-health regression tests.

## Phase 1.5 Completion Notes

- Backend planning data is exposed through `GET /api/planning/overview` and remains deterministic from existing accounts, transactions, commitments, decisions, and import logs.
- Frontend routes now include Goals, Sinking Funds, Monthly Review, and Subscriptions alongside the existing Phase 1 routes.
- Reports now include saved filters that deep-link into filtered transactions and planning views.
- Main controls now persist in the URL hash so browser refresh keeps date range, search,
  transaction filters, include-candidates, and Reports tab/grouping instead of resetting context.
- Calendar now shows a selected-period planner grid with per-day bill/subscription/commitment chips,
  daily totals, busiest-day summary, and collapsible current/recent/upcoming bill rows.
- Reports now use a D3 Sankey visualization with softer fluid flows, expandable spending leaves,
  Income source breakdown, square bars, inside-chart final node labels, visible summary flows, and
  lighter annotation typography.
- Dashboard now has a time-aware UK greeting, GBP formatting, focused household-position hero,
  spending pulse, compact Decision Queue preview, setup guidance only when incomplete, and
  date-aware bill naming (`Recent Bills`, `Bills This Month`, `Upcoming Bills`).
- Frontend GET requests are de-duplicated while in flight, reducing duplicate local refresh traffic
  under React dev StrictMode.
- The E2E suite checks every primary route for reachability, failed-fetch regressions, dead hash links, unnamed buttons, and horizontal overflow.
- The E2E suite also protects dashboard API availability, date-range bill-title behavior, compact dashboard Decision Queue rendering, transaction filters, refresh persistence, candidate-toggle scope, calendar planner behavior, colorful report/account graphics, fixed-sidebar scrolling, and Decision Queue desktop/mobile layouts.
- Remaining caveat: Phase 1.5 planning data is derived locally rather than user-authored persisted goals. Persisted custom goals can be part of Phase 2/3 if desired.

## Phase 1.75 - Editable Planning Control Plane

Phase 1.75 turns the Phase 1/1.5 read-only planning insights into editable household controls.
The implementation should stay local-first and deterministic: user-authored settings can be stored
client-side initially, but every money total shown in budget/cashflow/dashboard must tie back to
imported transactions, commitments, accounts, or explicit user-entered plan values.

- [x] Goals page: add custom goals, edit progress/targets, delete goals, and show derived goals beside user-authored goals.
- [x] Budget page: add a dedicated `#/budget` screen with monthly planned/actual/remaining rows by group/category, editable planned amounts, and summary totals.
- [x] Settings page: add a settings workbench for categories, tags, rules, and merchants with add/edit/delete/update interactions.
- [x] Import center: add a visible navigation/home for importing new Snoop data, previewing, committing, and rerunning transfer/bill detection.
- [x] Local data UX: replace the passive `Local data` badge with a purposeful action/status affordance that leads to import/data management.
- [x] Cash Flow page: improve from readiness-only into a planning view with projected balance, upcoming obligation summary, cash-pressure meter, and grouped cash events.
- [x] Dashboard: add more useful planning value without crowding: budget left, goal progress, cash after bills, decision pressure, and import action.
- [x] Tests: add browser coverage for goals CRUD, budget math, settings CRUD, import entry, route health, and refresh-safe behavior.
- [x] Accounting checks: planned, actual, remaining, net, and cashflow totals are GBP formatted and derived from imported insight/dashboard data plus explicit plan values.

## Phase 1.75 Completion Notes

- New primary routes: `#/budget` and `#/import`.
- Goals now support local add/edit/delete and refresh persistence while keeping derived goals visible.
- Budget now shows planned, actual, and remaining values by group with editable planned amounts.
- Settings now includes Categories, Merchants, Rules, Tags, Data, and System sections.
- The former passive `Local data` label is now an `Import data` action.
- Dashboard now includes a compact Planning Snapshot.
- Cash Flow now includes a richer Cash Flow Plan card with projected ending cash, lowest point, cash pressure, and dated cash events.
- Duplicate status cards were removed: data freshness is owned by Import, and system/API status is owned by Settings.
- Dashboard, Settings, Goals, and Budget received a final UI rhythm pass after Phase 1.75 feature implementation.
- Import and Settings now live behind the bottom-left Kiran/Household profile menu, reducing primary
  sidebar noise while keeping operational actions close to the local workspace identity.
- Settings creation actions now share one compact primary-button style, and the profile-menu chevron
  rotates on open/close for clear state feedback.
- Phase 1.75 preferences are local-first and browser-scoped by ADR-014; server-backed persistence remains a Phase 2 candidate.

## Phase 1.75 Non-Goals

- No real Open Banking connection.
- No cloud sync or multi-user collaboration.
- No automatic rule application that rewrites historical transactions without review.
- No private raw exports committed to git.
- No AI assistant actions that mutate finance data.

## Phase 2 - Household Expansion

- [x] Rule engine application workflow: preview rule impact, apply to selected transactions, and undo.
- [x] Merchant merge/split and merchant aliases.
- [x] PocketSmith-style cashflow scenario planning: what-if income/outflow changes, long-range projections, and scenario comparison.
- [x] Monarch-style budget modes: category budgeting, flexible budgeting, rollover handling, and shared household review.
- [x] Simplifi-style spending plan: income minus bills, subscriptions, savings goals, and left-to-spend.
- [x] Exportable reports and CSV exports for budget, transactions, and monthly review.

## Phase 2 Completion Notes

- Rules can be previewed against currently loaded transactions, applied to selected matching rows,
  and undone from the latest local rule-application snapshot.
- Merchant cleanup supports display-name aliasing/merging, ignore/restore, and split-back-to-source
  behavior; reports and insights use cleaned display labels without mutating raw imported merchant
  text.
- Cash Flow now includes what-if scenarios with income/outflow adjustments and baseline comparison.
- Budget now supports category, flexible, and rollover modes with visible planned/actual/remaining
  formulas.
- Dashboard includes a Spending Plan card that explains left-to-spend as income minus obligations,
  savings goals, and flexible actuals.
- Reports include CSV export controls for transactions, budget, monthly review, and category reports.
- Phase 2.1 remains the boundary for Business entity UI/imports and read-only local assistant work.

## Phase 2.1 - Business And Assistant Expansion

- Business entity active UI, including separate dashboards, categories, tax/reporting labels, and import lanes.
- Tide CSV parser and NatWest Business CSV parser.
- Local LLM assistant using deterministic app queries, read-only at first.

## Phase 3 - Integrations

- Open Banking provider evaluation.
- Connection freshness dashboard.
- Optional cross-device/cloud strategy if explicitly approved.
