<!---
ai-eos-metadata:
  purpose: "Walkthrough scripts and demo/storyboard outlines for Personal Finance Studio."
  how_to_use: "Use these scripts to create videos, demos, screenshots, or onboarding tours."
  generated_by: "Codex product architecture review"
--->

# Walkthroughs And Demo Scripts

These are script-ready walkthroughs. They are not rendered video files; use them as storyboards for
screen recordings, product demos, onboarding tours, or help-center articles.

## Walkthrough 1: First Import To Trusted Dashboard

**Goal:** Show a new user how raw CSV becomes a usable finance dashboard.

1. Start on Dashboard and point out API status.
2. Open `Workspace / Household > Import data`.
3. Choose a Snoop CSV.
4. Explain preview: rows, date range, accounts, duplicates, warnings.
5. Commit import.
6. Run transfer detection.
7. Run recurring bill detection.
8. Open Accounts and enter current balances.
9. Open Decision Queue and confirm/reject candidates.
10. Return to Dashboard and explain household position, left-to-spend, bills, and review focus.

**User outcome:** "I can trust the dashboard because I imported data, set balances, and reviewed high-impact decisions."

## Walkthrough 2: Weekly Money Review

**Goal:** Show the weekly rhythm for staying current.

1. Select `This month` or `Last 30 days`.
2. Open Decision Queue and clear important decisions.
3. Open Transactions and filter to unreviewed.
4. Update transaction type/group where needed.
5. Open Budget and compare planned, actual, remaining, and status.
6. Open Calendar to scan bills by date.
7. Open Cash Flow to check lowest projected point.

**User outcome:** "I know what changed this week and what needs attention."

## Walkthrough 3: Avoid A Cash Crunch

**Goal:** Show how Cash Flow and Calendar prevent timing surprises.

1. Open Cash Flow.
2. Explain starting cash, projected ending cash, lowest point, confirmed due, and candidate due.
3. Expand next cash events.
4. Add a what-if scenario for extra income or lower outflow.
5. Compare scenario ending cash with baseline.
6. Open Calendar and show which due dates create pressure.

**User outcome:** "I can test choices before cash gets tight."

## Walkthrough 4: Build And Maintain A Budget

**Goal:** Show how planned money connects to imported actuals.

1. Open Budget.
2. Explain Category, Flexible, and Rollover modes.
3. Enter planned amounts.
4. Explain actual outflow comes from imported transactions.
5. Explain remaining and status.
6. Switch to Rollover and add a rollover amount.
7. Use `Review actuals` to drill into Transactions.

**User outcome:** "My budget is a living plan tied to actual transaction evidence."

## Walkthrough 5: Clean Up Reports With Rules And Merchants

**Goal:** Show safe cleanup without corrupting raw imports.

1. Open Reports and show messy merchant/category grouping.
2. Open Settings > Merchants.
3. Rename or merge merchant display names.
4. Open Settings > Rules.
5. Preview rule impact on transactions.
6. Apply selected matches.
7. Undo latest rule application if needed.
8. Return to Reports and show cleaner grouping.

**User outcome:** "I can make reports readable while preserving original imported data."

## Walkthrough 6: Understand Spending With Sankey Reports

**Goal:** Show how the Sankey diagram reveals money flow.

1. Open Reports.
2. Select Cash Flow.
3. Explain income, outflows, and destination nodes.
4. Switch between category/group and top merchants.
5. Click an expandable node such as Debt or Flexible.
6. Switch to Spending and Income tabs.
7. Export a CSV summary.

**User outcome:** "I can see where money is coming from and where it is going."

## Walkthrough 7: Monthly Planning Reset

**Goal:** Show an end-of-month or start-of-month planning routine.

1. Open Monthly Review.
2. Review income, outflows, net, review coverage, and next actions.
3. Open Budget and adjust next month planned amounts.
4. Open Goals and update current amounts/contributions.
5. Open Sinking Funds and check non-monthly bills.
6. Open Reports for spending patterns.
7. Export monthly review if needed.

**User outcome:** "I close the month with clarity and start the next one deliberately."

## Suggested Video Assets

- 60-second product overview.
- 3-minute first import walkthrough.
- 2-minute weekly review workflow.
- 2-minute budget and cashflow planning workflow.
- 2-minute reports and Sankey explanation.
- 90-second settings/rules/merchant cleanup walkthrough.

## Screenshot Checklist

- Dashboard after completed import.
- Import Center preview and completed checklist.
- Accounts balance review.
- Decision Queue with pending items.
- Transactions with filters open.
- Calendar month grid with bill chips.
- Budget category and rollover modes.
- Cash Flow scenario panel.
- Reports Sankey with expanded spending node.
- Settings rules preview and merchant cleanup.
