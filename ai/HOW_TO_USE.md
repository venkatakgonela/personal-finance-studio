<!---
ai-eos-metadata:
  purpose: "User-facing operating guide and common workflows."
  how_to_use: "Read when onboarding a new user or validating page-level flows."
  generated_by: "Codex implementation planning"
--->

# How To Use Personal Finance Studio

## New User Flow

1. Start the local stack from the project root.
   - `./scripts/dev-local.sh`
   - If the UI shows API offline, open `Settings` from the Kiran/Household menu and use `Check API again`.

2. Open `Kiran / Household` in the bottom-left menu, then choose `Import data`.

3. Import a Snoop CSV.
   - Choose the CSV.
   - Preview row counts, detected accounts, date range, categories, and warnings.
   - Commit the import.
   - Run transfer detection.
   - Run recurring bill detection.

4. Review accounts.
   - Open `Accounts`.
   - Set account types such as current, savings, credit card, loan, BNPL, or unknown.
   - Enter current balances where missing.
   - Cash-on-hand and forecast confidence improve once balances are known.

5. Resolve high-impact decisions.
   - Open `Decision Queue`.
   - Confirm or reject transfer matches and recurring candidates.
   - This keeps income, spending, and cashflow reports from being inflated.

## Daily / Weekly Review

1. Use the top date selector to choose `This month`, `Last 30 days`, `Next 15 days`, `Next 30 days`, or a custom period.
2. Use global search for merchants, accounts, bills, or transactions.
3. Open `Transactions` to filter by account, category group, transaction type, review state, and posted/pending status.
4. Save transaction review changes when a transaction should become spending, income, debt payment, transfer, refund, ignored, or reviewed.

## Bills, Calendar, And Subscriptions

1. Open `Calendar` to see planned bills/subscriptions/commitments on the selected date grid.
2. Toggle `Include bill candidates` when you want candidate obligations included in planning.
3. Use `Recurring` to confirm or ignore detected recurring commitments.
4. Use `Subscriptions` to review cancellation, renegotiation, or confirmation prompts.
5. Use `Sinking Funds` for annual, quarterly, and custom bills translated into monthly set-asides.

## Budgeting

1. Open `Budget`.
2. Choose a mode.
   - `Category`: planned, actual, and remaining by group.
   - `Flexible`: income minus obligations, savings goals, and left-to-spend.
   - `Rollover`: add carried-forward amounts beside planned/actual/remaining.
3. Edit planned amounts directly in the table.
4. Use `Review actuals` to jump back to transaction evidence.

## Goals

1. Open `Goals`.
2. Add custom goals with target, current amount, monthly contribution, and due date.
3. Edit or delete custom goals as plans change.
4. Derived goals remain visible underneath custom goals and are based on imported data, balances, and review coverage.

## Cash Flow And Scenarios

1. Open `Cash Flow`.
2. Review starting cash, ending cash, lowest point, confirmed due, candidate due, and forecast events.
3. Use `Cash Flow Plan` to see projected ending cash, cash pressure, income, outflows, and bills in the selected window.
4. Add what-if scenarios for income/outflow changes.
5. Compare scenario ending cash against the baseline before changing real behavior.

## Reports And Exports

1. Open `Reports`.
2. Use Cash Flow, Spending, and Income tabs.
3. Switch grouping between category/group, top merchants, summary only, and income source where applicable.
4. Click expandable spending groups such as Debt or Flexible to drill into merchant buckets.
5. Use Exports to download CSVs for transactions, budget, monthly review, and report summaries.

## Settings And Cleanup

1. Open `Kiran / Household`, then `Settings`.
2. Use `Categories` and `Tags` for local planning labels.
3. Use `Rules` to preview matching transactions, apply to selected rows, and undo the latest rule application.
4. Use `Merchants` to rename, merge, ignore, restore, or split merchant labels for reports.
5. Use `Data` for local planning preference counts and quick links.
6. Use `System` to check API/frontend health.

## Good Operating Rhythm

1. Import fresh data.
2. Confirm transfers and recurring bills.
3. Review unreviewed transactions.
4. Update account balances.
5. Check Dashboard left-to-spend and Cash Flow pressure.
6. Adjust Budget and Goals.
7. Use Reports/Exports for deeper review.
