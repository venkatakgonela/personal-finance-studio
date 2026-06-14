<!---
ai-eos-metadata:
  purpose: "Strategic roadmap, release milestones, and development phases."
  how_to_use: "Consult to check feature phasing and release goals."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Roadmap - Personal Finance Studio

**Last reviewed:** 2026-06-14  
**Current phase:** Phase 1 complete locally; ready to enter Phase 1.5 planning depth.

## Milestones

| Milestone | Description | Status |
|---|---|---|
| Phase 0 | Planning docs, ADRs, specs, task breakdown | Complete |
| Phase 1 | Household Snoop import, transactions, transfers, commitments, forecast, dashboard | Complete locally |
| Phase 1.5 | Goals foundation, monthly review, richer reports, subscription review | Next |
| Phase 2 | Business entity imports, Tide/NatWest CSV, local LLM assistant | Not Started |
| Phase 3 | Optional Open Banking, sync health, advanced planning | Not Started |

## Phase 1 - Household Control Center

- [x] Snoop CSV import with preview and deduplication.
- [x] Account detection, classification, balance review, and include/exclude rules.
- [x] Transaction ledger with reviewed/unreviewed state.
- [x] Date-window controls and transaction filters for account, group, type, review state, status, and search.
- [x] Internal transfer detection and reconciliation.
- [x] Category normalization and transaction review actions.
- [x] Recurring commitment detection.
- [x] Bills, bill instances, variable amounts, annual/custom frequencies.
- [x] Calendar/upcoming commitments by selected date window.
- [x] Cashflow forecast and available-after-commitments formula.
- [x] Flexible spend remaining headline number.
- [x] Low-noise Decision Queue with desktop table and mobile review-card layout.
- [x] Basic Insights and Reports route.
- [x] Backend, API, frontend unit, and browser end-to-end tests for critical flows.

## Phase 1 Completion Notes

- The local app now has React hash routes for Dashboard, Accounts, Transactions, Cash Flow, Calendar, Recurring, Reports, and Decision Queue.
- The backend exposes deterministic APIs for imports, accounts, transactions, transfers, commitments, calendar, forecast, dashboard, insights, and decisions.
- Playwright E2E starts/checks both the frontend and backend, including a real-stack dashboard smoke test that fails if the API is down and the UI would show `Failed to fetch`.
- Remaining Phase 1 caveat: this is locally complete, not a packaged release. Data is still local/dev-server oriented and Open Banking/cloud sync remain out of scope.

## Phase 1.5 - Planning Depth

- Goals screen.
- Sinking fund manager and non-monthly expense planning.
- Monthly review workflow.
- Subscription review and cancellation/renegotiation prompts.
- Saved/custom report filters.
- Better filter UI patterns: saved date ranges, URL query persistence, and richer report drilldowns.
- Import freshness and stale recurring-commitment review UX.

## Phase 2 - Expansion

- Business entity active UI.
- Tide CSV parser.
- NatWest Business CSV parser.
- Local LLM assistant using deterministic app queries.

## Phase 3 - Integrations

- Open Banking provider evaluation.
- Connection freshness dashboard.
- Optional cross-device/cloud strategy if explicitly approved.
