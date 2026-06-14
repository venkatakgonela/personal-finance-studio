# SPEC-002: Screen Plan & Design System

**Author:** Kiran Gonela / Codex  
**Status:** Draft  
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
Warm Ivory:       #F7F3EA
Soft Cream:       #FFFDF7
Linen:            #EFE8DA
Deep Forest:      #173B2F
Almost Black:     #10231C
Accent Sage:      #8A9B83
Success Green:    #247A4D
Soft Clay:        #C97C5D
Amber:            #D99A2B
Muted Red:        #B85C5C
Warm Stone:       #D8D0C2
Grey Olive:       #69746C
```

## 3. Typography

- Headings: Fraunces or similar editorial serif.
- Body: Source Sans 3 or Manrope.
- Numbers: Geist Mono or tabular numbers in the body font.

## 4. Data Confidence Language

- Actual: solid Deep Forest text.
- Estimated: muted text, `~` prefix, small estimated label.
- Forecast: sage marker or light chart line with forecast label.
- Pending: Amber badge.
- Paid/confirmed: Success Green badge.
- Risk/overdue: Muted Red badge.

## 5. Screens

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

- Ledger with search, filters, category edit, reviewed toggle.
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

### Insights

- Spending by category.
- Top merchants.
- Month-over-month change.
- Recurring spend total.
- BNPL/debt pressure.
- Internal transfers excluded.

## 6. UI Principles

- Prefer fewer, more useful numbers.
- Show formulas or assumptions where trust matters.
- Do not over-chart.
- Make every dashboard card answer a real household decision.
- Keep finance labels plain English.
