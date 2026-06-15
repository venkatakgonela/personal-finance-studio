<!---
ai-eos-metadata:
  purpose: "Backlog of missing pieces, good-to-have features, and future product enhancements."
  how_to_use: "Review before planning Phase 2.1, Phase 3, or product hardening work."
  generated_by: "Codex product architecture review"
--->

# New Enhancements Backlog

## Highest-Value Missing Pieces

| Enhancement | Why it matters | Suggested phase |
|---|---|---|
| Backend entity scoping for Household vs Business | The UI has a context switcher shell, but data still defaults to household. Business needs isolated imports, accounts, categories, rules, reports, and exports. | Phase 2.1 |
| Business CSV import lanes | Tide and NatWest Business imports are needed before the Business context is meaningful. | Phase 2.1 |
| Date-window-aware dashboard summary API | Dashboard `30-day after bills` is labelled clearly, but should eventually match selected windows for full arithmetic consistency. | Phase 2.1 |
| Server-backed settings persistence | Goals, budgets, rules, merchant preferences, and tags are currently local-first/browser scoped. Server persistence improves reliability and portability. | Phase 2.1 / Phase 3 |
| Settings backup/restore export | Local-first preferences need a way to be backed up and moved between browsers/devices. | Phase 2.1 |
| Guided first-run checklist | Import, balances, decisions, budget, and dashboard trust could be presented as a single onboarding journey. | Phase 2.1 |
| Data quality score | A single confidence score based on freshness, balances, unreviewed transactions, open decisions, and stale commitments would help users know whether to trust numbers. | Phase 2.1 |
| FreeAgent OAuth hardening | Manual-token FreeAgent import works; full browser OAuth callback, token refresh UX, sync-health detail, and pre-commit preview remain. | Phase 3 |
| Bank/Open Banking integration evaluation | CSV import is useful but manual. Optional Open Banking could reduce effort if privacy/consent is acceptable. | Phase 3 |

## Product Enhancements

### Onboarding

- Add a first-run wizard that walks users through import, commit, transfer detection, bill detection, account balances, and first dashboard review.
- Add sample/demo data mode so a new user can explore without importing private data.
- Add "What does this number mean?" help popovers for left-to-spend, after bills, cash pressure, and budget remaining.
- Add a visible "last successful import" and "next recommended action" banner on Dashboard.

### Data Import

- Add full FreeAgent browser OAuth callback and automatic refresh-token flow.
- Add FreeAgent pre-commit preview with row counts, date range, duplicate count, and selected account confirmation before import.
- Add import history with rollback for the latest import batch.
- Add CSV mapping UI for non-Snoop formats.
- Add duplicate import explanation page with skipped/duplicate transaction details.
- Add import validation report for missing dates, malformed amounts, unknown accounts, and suspicious rows.
- Add attachments/receipts support for selected transactions.

### Accounts

- Add account include/exclude toggles for cash-on-hand and forecast participation.
- Add opening/current balance timeline so imported net movement can reconcile to balance.
- Add account grouping for cash, savings, credit, loans, BNPL, investments, and ignored accounts.
- Add balance history chart per account.
- Add "needs balance review" filter.
- Add overdraft review reminders when account balance is negative and the overdraft limit is absent/stale.

### Transactions

- Add split transactions.
- Add bulk edit for selected transactions.
- Add saved transaction views beyond the current saved filter links.
- Add rule suggestions from repeated manual edits.
- Add notes and attachments.
- Add merchant/category confidence indicators.
- Add advanced amount filters, e.g. greater than, less than, between.

### Decision Queue

- Add server-backed pagination.
- Add "why suggested" evidence panels for transfer and recurring candidates.
- Add batch confirm/reject when confidence is high.
- Add snooze/remind-later for uncertain decisions.
- Add decision history so users can audit past confirmations/rejections.

### Budget

- Add budget templates such as "starter household", "aggressive debt payoff", and "low volatility".
- Add monthly copy/roll-forward from previous period.
- Add category-level notes and assumptions.
- Add over-budget explanations linked to transactions.
- Add envelope-style allocation for flexible spending.
- Add yearly budget view and month-by-month comparison.
- Add budget alerts when actual spend crosses a threshold.
- Promote safe-spend assumptions from localStorage to server-backed preferences once backup/restore or multi-device persistence is needed.

### Goals And Sinking Funds

- Add goal funding source/account selection.
- Add automatic monthly contribution recommendations from cashflow.
- Add goal priority ordering.
- Add progress projections based on planned contribution and due date.
- Add pause/complete/archive states for goals.
- Add sinking fund payment history and due-date reminders.

### Bills, Calendar, And Subscriptions

- Add bill editing for expected amount, cadence, next due date, and category.
- Add missed/overdue bill state.
- Add calendar month/week/day toggle.
- Add reminder rules.
- Add subscription price-change detection.
- Add cancellation outcome tracking.
- Add "annualized subscription cost" summaries.

### Cash Flow

- Add longer-range projections, e.g. 3, 6, and 12 months.
- Add recurring income detection and explicit payday modeling.
- Add scenario comparison table with multiple scenarios side by side.
- Add cashflow stress warnings for lowest-point thresholds.
- Add optional flexible spend assumptions rather than only actual flexible spend.
- Add forecast confidence based on candidate/confirmed bill mix.

### Reports

- Add trend charts by month for income, expenses, net, and savings rate.
- Add category heatmap.
- Add merchant trend report.
- Add cashflow Sankey export as image/SVG.
- Add report annotations.
- Add compare periods: this month vs last month, this year vs last year.
- Add drill-through from Sankey nodes to filtered transactions.
- Consider Recharts/Nivo only when chart interactivity requirements exceed current D3/SVG implementation; avoid broad chart rewrites for cosmetic-only changes.

### Settings And Rules

- Add server-backed categories, tags, merchants, and rules.
- Add rule priority ordering.
- Add rule test suite using known sample transactions.
- Add merchant alias conflict detection.
- Add category hierarchy and custom icons/colors.
- Add tag transaction counts and tag-filter drilldowns.
- Add dashboard layout export/import when local preferences remain browser-scoped.
- Add dashboard widget sizing/resizing only if fixed widget ordering is no longer enough; prefer keeping cards content-driven until a clear resizing need exists.

### Local Assistant

- Add read-only assistant over deterministic app queries.
- Restrict assistant to explain, summarize, and navigate first.
- Add citations back to transaction/report rows.
- Add "suggest next action" based on data quality score.
- Do not allow assistant mutations until explicit approval and audit logs exist.

### Security, Privacy, And Reliability

- Add local database backup/restore.
- Add encrypted local export option.
- Add data deletion/reset screen with confirmation.
- Add audit log for mutations: imports, rule applications, balance edits, decision actions.
- Add app version and migration visibility.
- Add offline-safe error states for every route.

### Mobile And Accessibility

- Add responsive budget table alternatives for narrow screens.
- Add keyboard shortcuts for review workflows.
- Add ARIA descriptions for chart controls and Sankey nodes.
- Add reduced-motion mode.
- Add high-contrast theme.
- Add larger tap targets for decision and transaction actions.

## Product Risks To Track

- Local-first preferences can be lost if browser storage is cleared.
- Dashboard layout, custom widgets, budget assumptions, goals, rules, merchants, tags, and rollovers are browser-local until server-backed preferences are implemented.
- Business context is visible but not yet data-isolated.
- CSV imports require users to obtain/export data manually.
- Forecast quality depends on current balances, overdraft limits, recurring bill detection, and explicit safe-spend assumptions.
- Dashboard arithmetic can feel inconsistent unless every metric clearly states its date window.
- Reports are only as good as transaction classification and merchant cleanup.

## Suggested Next Implementation Order

1. Server-backed preference persistence and backup/restore.
2. True Household/Business entity scoping.
3. Business CSV import lanes.
4. Date-window-aware dashboard summary.
5. Guided first-run onboarding.
6. Data quality score.
7. FreeAgent OAuth callback/refresh and import preview hardening.
8. Bill editing and reminder workflow.
9. Split transactions and bulk transaction editing.
10. Longer-range cashflow projections.
