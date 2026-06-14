<!---
ai-eos-metadata:
  purpose: "Strategic roadmap, release milestones, and development phases."
  how_to_use: "Consult to check feature phasing and release goals."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Roadmap - Personal Finance Studio

**Last reviewed:** 2026-06-14  
**Current phase:** Phase 1.5 complete locally; ready to enter Phase 2 expansion planning.

## Milestones

| Milestone | Description | Status |
|---|---|---|
| Phase 0 | Planning docs, ADRs, specs, task breakdown | Complete |
| Phase 1 | Household Snoop import, transactions, transfers, commitments, forecast, dashboard | Complete locally |
| Phase 1.5 | Goals foundation, monthly review, richer reports, subscription review | Complete locally |
| Phase 2 | Business entity imports, Tide/NatWest CSV, local LLM assistant | Not Started |
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

## Phase 2 - Expansion

- Business entity active UI.
- Tide CSV parser.
- NatWest Business CSV parser.
- Local LLM assistant using deterministic app queries.

## Phase 3 - Integrations

- Open Banking provider evaluation.
- Connection freshness dashboard.
- Optional cross-device/cloud strategy if explicitly approved.
