# SPEC-002: Screen Plan & Design System

**Author:** Kiran Gonela / Codex  
**Status:** Phase 1.75 implemented locally
**Date:** 2026-06-15

## 1. Design Direction

Personal Finance Studio should feel like a private financial planning desk:

- Calm, premium, readable.
- Practical rather than decorative.
- Lower anxiety than a bank app.
- Clear about actuals, estimates, forecasts, and pending data.
- Inspired by Monarch calmness, YNAB clarity, PocketSmith forecasting, and local-first privacy.

## 2. Palette

```text
App Background:   #F6F4EF
Sidebar:          #FBFAF7
Card:             #FFFFFF
Muted Surface:    #F5F3EF
Line:             #E4E0D8
Strong Line:      #CBC4B8
Primary Ink:      #1F2924
Body Text:        #20231F
Muted Text:       #6F746E
Soft Text:        #9B9F98
Focus Teal:       #2587A6
Focus Teal Soft:  #EAF6F8
Success Green:    #2F7D5C
Success Soft:     #E8F2ED
Amber:            #D99A2B
Muted Red:        #B85C5C
```

Use teal for navigation, focus, selected states, and neutral progress. Use green only when the
meaning is explicitly positive or confirmed. Avoid mixing orange and green as the primary visual
language; warm colours are reserved for warnings or exceptions.

## 3. Typography

- Current implementation uses Inter for headings, body, controls, and tabular financial values after the Monarch-inspired typography cleanup.
- Keep numeric values tabular via `font-variant-numeric: tabular-nums`.
- Do not reintroduce mismatched editorial/highlight fonts without a full design-system decision.

## 4. Data Confidence Language

- Actual: solid Deep Forest text.
- Estimated: muted text, `~` prefix, small estimated label.
- Forecast: teal marker or light chart line with forecast label.
- Pending: Amber badge.
- Paid/confirmed: Success Green badge.
- Risk/overdue: Muted Red badge.

## 5. Navigation Model

The app uses distinct page routes, not dashboard anchor jumps:

- `#/dashboard`
- `#/accounts`
- `#/transactions`
- `#/cash-flow`
- `#/calendar`
- `#/budget`
- `#/recurring`
- `#/goals`
- `#/sinking-funds`
- `#/monthly-review`
- `#/subscriptions`
- `#/reports`
- `#/decision-queue`
- `#/import`
- `#/settings`

Dashboard cards may preview important data, but clicking primary navigation must change the
current page and page title. Dedicated pages can show fuller lists and controls than dashboard
previews.

## 6. Screens

### Setup / Import

- Import Snoop CSV.
- Preview detected date range, columns, row counts.
- Show accounts discovered.
- Show balances if present; otherwise request review/edit.
- Show import summary: imported, duplicate, skipped, invalid.
- Phase 1.75 adds a dedicated Import Center route so fresh data entry is discoverable after initial setup.
- The global data affordance should be an action/status control, not a passive `Local data` label.
- Import freshness/status belongs on the Import Center and should not be duplicated on Goals.

### Household Dashboard

- Time-aware UK greeting in the page title.
- Today's household position hero with cash readiness, available after commitments, flexible spend remaining, selected-window bills, Decision Queue count, and data freshness.
- Spending Pulse card with categorized outflow bars and flexible allowance context.
- Bills card with date-aware naming: `Recent Bills` for historical ranges, `Bills This Month` for current month, and `Upcoming Bills` for future windows.
- Compact Decision Queue preview; full review table belongs on the Decision Queue page.
- Cash Flow readiness/forecast card.
- Keep the dashboard focused on household decisions. Avoid duplicating the hero's balance-readiness
  message in a second card; show setup/import guidance only when the workspace is incomplete.
- Phase 1.75 dashboard should add value through compact planning signals: budget remaining, active
  goal progress, cashflow risk, next bills, open decisions, and import freshness.

### Calendar

- Today, week, 15-day, month, custom range.
- Historical ranges should not be labelled as upcoming.
- Bills, subscriptions, loans, credit cards, BNPL, income.
- Clear actual/estimated/pending labels.
- Current implementation includes a selected-period calendar grid with daily planned totals,
  commitment chips, a busiest-day summary, and a collapsible bill list whose title changes between
  `Recent bills`, `Current bills`, and `Upcoming bills`.

### Cashflow Forecast

- Starting balance.
- Income.
- Commitments.
- Flexible spend assumption.
- Projected ending balance.
- Lowest projected balance point.
- Phase 1.75 turns Cash Flow into a richer planning screen with projected-balance summary,
  obligation pressure, candidate-vs-confirmed context, and dated upcoming cash events.

### Transactions

- Ledger with global search, selected date window, account filter, category group filter, transaction type filter, reviewed/unreviewed filter, posted status filter, amount/date/account/group columns, type edit, and reviewed save action.
- Mark as internal transfer, debt payment, refund, ignored, or needs review.

### Bills & Commitments

- Confirmed bills.
- Subscriptions.
- Credit-card payments.
- Loans.
- BNPL.
- Recurring candidates.
- Annual/custom/one-off support.

### Goals

- Emergency-buffer and review-coverage goals derived from real local data.
- Progress bars, current/target/monthly-set-aside metrics, and next action copy.
- Links into Cash Flow and Monthly Review so goals are not a dead-end screen.
- Phase 1.75 adds user-authored goals with add/edit/delete controls, due dates, monthly
  contribution, and local refresh persistence.
- Goals should focus on goal creation and progress only; data freshness belongs in Import.

### Budget

- Dedicated `#/budget` route.
- Monthly planned, actual, and remaining values by group/category.
- Editable planned amounts.
- Summary card for income, planned spend, actual spend, remaining, and over/under status.
- Clear formula copy so users can trust the tally.
- Budget data may start as local-first preferences, but actuals must come from imported
  transaction/insight data.

### Sinking Funds

- Annual, quarterly, custom, and non-monthly commitments converted into monthly set-asides.
- Each fund shows due date, status, target amount, and recurring review action.

### Monthly Review

- Current month income, outflows, net position, reviewed/unreviewed counts, open decisions, and next actions.
- Saved filter links for common review drilldowns.

### Subscriptions

- Subscription-style recurring commitments with cancellation, renegotiation, or confirmation prompts.
- Links back into Recurring for the actual commitment review workflow.

### Accounts

- Provider, account name, type, balance, owner, include/exclude from cash and forecast.
- Account freshness and source.

### Decision Queue

- High-impact confirmations only.
- Each decision should explain why it matters.
- Actions should train rules or suppress future noise.
- Current UI uses a desktop review table with summary pills and collapses to mobile-friendly review cards.

### Settings / System Status / Data Controls

- Show backend API health clearly.
- Explain how to start the local stack when the API is offline.
- Keep this operational status separate from finance data so users understand service problems quickly.
- Phase 1.75 adds a Settings workbench:
  categories, merchants, rules, tags, data/import status, and system status.
- Category, tag, rule, and merchant preference edits can be local-first in Phase 1.75, but should be
  labelled as local planning settings until server persistence exists.
- System status belongs in Settings and should not be repeated in the Import Center.

### Insights

- Spending by category.
- Top merchants.
- Month-over-month change.
- Recurring spend total.
- BNPL/debt pressure.
- Internal transfers excluded.

### Reports

- Cash Flow, Spending, and Income report tabs.
- D3 Sankey cash-flow visualization that adapts to selected grouping and report tab.
- Category leaves such as Debt and Flexible can expand on click into merchant buckets, with large
  groups capped to top merchants plus `Other merchants`.
- Income defaults to income-source grouping, with an optional `Summary only` view that still connects
  Paychecks, Total income, and Available funds with visible flow color.
- Final Sankey nodes stay inside the chart; labels sit close to their bars and use lighter,
  annotation-style typography so the flow bands remain dominant.
- Category/merchant grouping controls should change the rendered destinations without requiring a
  page reload.
- Report summary strip should show income, expenses, and net in GBP for the selected date window.

## 7. UI Principles

- Prefer fewer, more useful numbers.
- Persist user selections in the URL hash wherever a refresh should keep context: date range,
  custom dates, search, include-candidates, transaction filters, and report tab/grouping.
- Show formulas or assumptions where trust matters.
- Do not over-chart.
- Make every dashboard card answer a real household decision.
- Keep finance labels plain English.
- Keep page content on a centered, bounded canvas rather than stretching indefinitely on wide
  screens.
- Use contained row cards for money lists, account review rows, recurring candidates, and decision
  items so actions feel attached to the data they affect.
- Collapse secondary page grids before controls become cramped; avoid forcing two columns when the
  readable area is too narrow.
- Leave clear spacing between summary metadata and tables, especially Decision Queue summary pills and review rows.
- Use collapsible blocks wherever a page has secondary grouped lists below a primary summary or
  chart, including Accounts, Dashboard insight groups, Calendar bills, and planning/review sections.
- For chart typography, prefer compact annotation labels over bold display text. Currency values can
  be slightly stronger than labels, but should not visually overpower bars or flows.

## 8. Current UI Status

- Implemented pages: Dashboard, Accounts, Transactions, Cash Flow, Calendar, Recurring, Goals, Sinking Funds, Monthly Review, Subscriptions, Reports, Decision Queue, Settings.
- Implemented global controls: search, date range preset/custom controls, include-candidates toggle.
- Implemented transaction controls: account, group, type, review state, status, and clear filters.
- Implemented planning controls: saved report filters and URL-hash persistence for date range,
  search, include-candidates, transaction filters, and Reports tab/grouping.
- Implemented dashboard polish: time-aware UK greeting, GBP-only money formatting, date-aware bills
  terminology, focused household-position hero, Spending Pulse, compact dashboard Decision Queue
  preview, setup card only when incomplete, fixed sidebar, and hidden main scrollbar.
- Implemented calendar polish: selected-period calendar grid, daily planned totals, commitment chips,
  collapsible bill list, and candidate-toggle-aware planning data.
- Implemented reports polish: D3 Sankey reports, adaptive Cash Flow/Spending/Income tabs, category
  vs merchant/source grouping, expandable spending leaves, income-source breakdown, square node bars,
  internal destination labels, visible summary flows, and softened chart typography.
- Implemented performance polish: frontend GET de-duplication prevents React dev StrictMode from
  duplicating identical in-flight API requests during refresh.
- Implemented verification: Playwright checks dashboard API availability, dashboard date-range bill-title behavior, compact dashboard Decision Queue rendering, transaction filter behavior, refresh persistence, Phase 1.5 planning routes, all-route UI health, candidate toggle scope, calendar planner updates, colorful account/report graphics, fixed-sidebar scrolling, Decision Queue desktop layout, and Decision Queue mobile actions.
- Implemented Phase 1.75 pages: Budget and Import Center.
- Implemented Phase 1.75 upgrades: editable goals, editable local taxonomy/rules/tags/merchant
  preferences, richer Cash Flow, richer Dashboard, and a purposeful data/import topbar action.
- Implemented Phase 1.75 UI cleanup: removed duplicated status cards, normalized Settings menu
  styling, made Goals a cleaner full-width planning page, and aligned Budget to the app's row/table
  rhythm.
