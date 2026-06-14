<!---
ai-eos-metadata:
  purpose: "Strategic roadmap, release milestones, and development phases."
  how_to_use: "Consult to check feature phasing and release goals."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Roadmap - Personal Finance Studio

## Milestones

| Milestone | Description | Status |
|---|---|---|
| Phase 0 | Planning docs, ADRs, specs, task breakdown | In Progress |
| Phase 1 | Household Snoop import, transactions, transfers, commitments, forecast, dashboard | Not Started |
| Phase 1.5 | Goals foundation, monthly review, richer reports, subscription review | Not Started |
| Phase 2 | Business entity imports, Tide/NatWest CSV, local LLM assistant | Not Started |
| Phase 3 | Optional Open Banking, sync health, advanced planning | Not Started |

## Phase 1 - Household Control Center

- Snoop CSV import with preview and deduplication.
- Account detection, classification, balance review, and include/exclude rules.
- Transaction ledger with reviewed/unreviewed state.
- Internal transfer detection and reconciliation.
- Category normalization and merchant rules.
- Recurring commitment detection.
- Bills, bill instances, variable amounts, annual/custom frequencies.
- Calendar by today, week, 15 days, month, and custom range.
- Cashflow forecast and available-after-commitments formula.
- Flexible spend remaining headline number.
- Low-noise Decision Queue.
- Basic Insights and reports.
- Backend, API, and browser end-to-end tests for critical flows.

## Phase 1.5 - Planning Depth

- Goals screen.
- Sinking fund manager.
- Monthly review workflow.
- Subscription review.
- Saved/custom report filters.

## Phase 2 - Expansion

- Business entity active UI.
- Tide CSV parser.
- NatWest Business CSV parser.
- Local LLM assistant using deterministic app queries.

## Phase 3 - Integrations

- Open Banking provider evaluation.
- Connection freshness dashboard.
- Optional cross-device/cloud strategy if explicitly approved.
