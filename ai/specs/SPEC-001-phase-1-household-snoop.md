# SPEC-001: Phase 1 Household Snoop Import & Finance Control Center

**Author:** Kiran Gonela / Codex  
**Status:** Draft  
**Date:** 2026-06-14

## 1. Problem Statement

The household has multiple accounts, weekly income, bills throughout the month, credit cards, loans, BNPL/pay-later purchases, variable bills, unplanned spending, and multiple profiles. A simple bill tracker is not enough.

Phase 1 must turn Snoop CSV data into a trustworthy local finance control center that explains current position, upcoming obligations, flexible spend, and future balance pressure.

## 2. Goals

- Import Snoop CSV into a durable local database.
- Scope all imported data to the Household entity.
- Detect accounts, categories, balances where available, and transaction status.
- Classify internal transfers before dashboard/insights calculations.
- Normalize categories into fixed, flexible, non-monthly, income, debt, transfer, and ignored groups.
- Detect recurring commitments and require confirmation before using them as bills.
- Support variable bills with expected, estimated, and actual amounts.
- Flag stale or overdue recurring patterns when the expected cadence is missed, so the user can confirm whether the commitment is still active.
- Support annual/custom/one-off frequencies for future sinking funds.
- Show cash on hand, available after commitments, flexible spend remaining, and upcoming obligations.
- Keep Decision Queue useful and low-noise.

## 3. Non-Goals

- No Open Banking.
- No Business CSV import.
- No full Goals UI.
- No LLM assistant.
- No investment tracking.
- No cloud sync or auth.
- No multi-currency support in Phase 1; all cash, bills, forecasts, and reports assume GBP.

## 4. Snoop CSV Shape

Observed sample columns:

```text
Date, Merchant Name, Description, Amount, Category, Notes,
Account Provider, Account Name, Status, Sub Type
```

The importer must tolerate optional future balance columns if Snoop provides them in newer exports.

Daily import gaps should be handled through import freshness rather than special catch-up logic. If Snoop exports are full-history, the next successful import should upsert any missing records while import freshness still shows that a gap occurred.

## 5. Build Sequence

1. Bootstrap app shell and database.
2. Implement entity/profile/account schema.
3. Implement Snoop import preview.
4. Implement fingerprinting/upsert and import logs.
5. Implement account classification and balance review.
6. Implement internal transfer detection and reconciliation.
7. Implement transaction ledger and reviewed state.
8. Implement category normalization and rules.
9. Implement recurring commitment detection.
10. Implement commitments and bill instances.
11. Implement calendar.
12. Implement cashflow forecast.
13. Implement dashboard.
14. Implement Decision Queue.
15. Implement basic Insights.

## 6. Available Money Formula

Phase 1 must show at least two numbers:

```text
Cash on hand =
  sum(included current/savings/pot account balances)
  excluding credit lines, loans, BNPL, business accounts, closed accounts

Available after commitments =
  cash on hand
  - confirmed upcoming obligations in selected window
  - reserved/earmarked amounts
```

Flexible spend remaining:

```text
Flexible spend remaining =
  planned flexible allowance for period
  - actual flexible spending in period
  - pending flexible spending where included
```

## 7. Decision Queue Rules

Decision Queue should only ask questions that materially improve forecast or reporting accuracy:

- Confirm internal transfer candidate.
- Confirm recurring commitment candidate.
- Confirm recurring commitment still active when its expected cadence becomes stale or overdue.
- Mark matched transaction as paid bill.
- Update bill estimate after material amount change.
- Approve category rule that affects future transactions.
- Confirm BNPL pattern as active obligation.

Avoid generic review noise.

## 8. Verification Plan

- Import sample Snoop CSV and confirm row count.
- Confirm duplicate import does not duplicate transactions.
- Confirm transfer matches are excluded from spend/income reports.
- Confirm paired internal transfers are linked as one transfer event where possible, not surfaced as two unrelated decisions.
- Confirm missed daily imports surface as stale import freshness without breaking the next successful full-history import.
- Confirm dashboard calculations do not include credit-card limits or loans as available cash.
- Confirm bill estimates are visibly distinct from actual paid amounts.
- Confirm stale recurring commitments appear as a Decision Queue item rather than silently remaining active forever.
- Confirm a user can answer a Decision Queue item and future similar rows are handled automatically.
