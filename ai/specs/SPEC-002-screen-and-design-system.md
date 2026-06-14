# SPEC-002: Screen Plan & Design System

**Author:** Kiran Gonela / Codex  
**Status:** Implemented locally; Phase 1.5 refinements next  
**Date:** 2026-06-14

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
- `#/recurring`
- `#/reports`
- `#/decision-queue`

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

### Household Dashboard

- Cash on hand.
- Available after commitments.
- Flexible spend remaining this week.
- Due today / this week / next 15 days.
- Expected income.
- Low-balance warnings.
- Decision Queue preview.
- Upcoming timeline.

### Calendar

- Today, week, 15-day, month, custom range.
- Bills, subscriptions, loans, credit cards, BNPL, income.
- Clear actual/estimated/pending labels.

### Cashflow Forecast

- Starting balance.
- Income.
- Commitments.
- Flexible spend assumption.
- Projected ending balance.
- Lowest projected balance point.

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

### Accounts

- Provider, account name, type, balance, owner, include/exclude from cash and forecast.
- Account freshness and source.

### Decision Queue

- High-impact confirmations only.
- Each decision should explain why it matters.
- Actions should train rules or suppress future noise.
- Current UI uses a desktop review table with summary pills and collapses to mobile-friendly review cards.

### Insights

- Spending by category.
- Top merchants.
- Month-over-month change.
- Recurring spend total.
- BNPL/debt pressure.
- Internal transfers excluded.

## 7. UI Principles

- Prefer fewer, more useful numbers.
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

## 8. Current UI Status

- Implemented pages: Dashboard, Accounts, Transactions, Cash Flow, Calendar, Recurring, Reports, Decision Queue.
- Implemented global controls: search, date range preset/custom controls, include-candidates toggle.
- Implemented transaction controls: account, group, type, review state, status, and clear filters.
- Implemented verification: Playwright checks dashboard API availability, transaction filter behavior, Decision Queue desktop layout, and Decision Queue mobile actions.
