<!---
ai-eos-metadata:
  purpose: "Product-level feature guide, user onboarding, workflows, and end-user expectations."
  how_to_use: "Read when explaining what Personal Finance Studio does, onboarding a user, or evaluating product gaps."
  generated_by: "Codex product architecture review"
--->

# Personal Finance Studio Product Guide

## Product Promise

Personal Finance Studio is a local-first personal finance control center for individuals and
households. It turns imported finance data into a practical planning workspace: what came in, what
went out, what bills are coming, what needs review, and what is safe to spend.

The current product is optimized for private, deterministic household finance management. It is not
yet an Open Banking app, tax product, investment platform, or cloud collaboration service.

## Who It Is For

- Individuals who want a clear picture of income, spending, bills, and available money.
- Households that use CSV exports and want local control before trusting automated connections.
- Users who want to clean messy transaction data without losing the original imported evidence.
- Users who want forecasting, budgets, recurring bills, goals, and reports in one place.

## Feature Inventory

| Feature | What it does | Why it matters |
|---|---|---|
| Import Center | Imports Snoop CSV files, previews rows/accounts/categories, commits data, reruns transfer and bill detection. | Clean onboarding starts with trusted data. Previewing prevents accidental bad imports. |
| API/System Status | Shows whether the local backend is online and how to retry. | Users need to know when a problem is service availability rather than finance data. |
| Accounts | Lists detected accounts, account types, imported net movement, and editable current balances. | Accurate balances power cash-on-hand, forecast confidence, and available-money planning. |
| Transactions Ledger | Searchable/filterable transaction table with date, account, group, type, reviewed state, and save actions. | Transactions are the source evidence for every report, budget actual, and review workflow. |
| Internal Transfer Detection | Finds likely money movements between own accounts and routes them to Decision Queue. | Transfers should not inflate income or spending. |
| Recurring Bills Detection | Finds subscriptions, bills, debt payments, BNPL, and recurring commitments. | Forecasting and left-to-spend only work if future obligations are visible. |
| Decision Queue | Review inbox for high-impact confirmations such as transfers and recurring candidates. | Keeps noisy automation under user control and improves accounting accuracy. |
| Dashboard | A compact household briefing with position, left-to-spend, upcoming/recent bills, spending pulse, budget/goals, review pressure, and cash-flow readiness. | Gives a fast answer to "Am I okay, and what should I look at next?" |
| Calendar | Selected-period bill calendar with daily planned totals and bill chips. | Dates matter in personal finance; users need to know when money leaves. |
| Cash Flow | Forecasts starting/ending cash, lowest point, due commitments, and candidate obligations. | Helps users avoid cash crunches before they happen. |
| What-if Scenarios | Adds local income/outflow adjustments and compares ending cash against baseline. | Lets users test choices before changing real spending. |
| Budget | Category, flexible, and rollover modes with planned, actual, remaining, and status. | Turns past transactions into a live plan users can steer. |
| Goals | Custom goals plus derived goals with target/current/monthly contribution tracking. | Connects saving intentions to monthly planning behavior. |
| Sinking Funds | Converts annual, quarterly, and non-monthly commitments into monthly set-asides. | Prevents large irregular bills from feeling like surprises. |
| Monthly Review | Summarizes income, outflows, net, reviewed/unreviewed counts, decisions, and next actions. | Creates a repeatable financial review ritual. |
| Subscriptions | Highlights recurring subscription-style commitments with action prompts. | Helps users cancel, renegotiate, or confirm recurring spend. |
| Reports | Cash Flow, Spending, and Income reports with Sankey visualizations and group/merchant/source controls. | Makes patterns visible faster than a table. |
| Exports | CSV exports for transactions, budgets, monthly review, and category reports. | Lets users keep portable records and do external analysis. |
| Settings Workbench | Local categories, tags, rules, merchants, data, and system controls. | Gives users control over classification and reporting quality. |
| Rules | Preview/apply/undo transaction rule changes. | Speeds up cleanup without silently rewriting data. |
| Merchant Cleanup | Rename, merge, ignore, restore, or split merchant display labels. | Reports become readable while preserving raw imported merchant text. |
| URL Persistence | Keeps date range, filters, search, report tab/grouping, and include-candidate state in the URL hash. | Refreshes and shared local links preserve context. |

## Why These Features Matter Together

Personal finance breaks down when data is fragmented:

- Accounts answer "What do I have?"
- Transactions answer "What happened?"
- Bills answer "What is committed?"
- Budget answers "What did I intend?"
- Cash Flow answers "Will timing hurt me?"
- Goals answer "What am I building toward?"
- Reports answer "What patterns should I notice?"
- Decision Queue answers "What needs human judgment?"

The app is valuable because these pieces reinforce each other. A confirmed transfer cleans reports.
A reviewed bill improves forecast. A current balance improves available money. A budget row links
planned money to imported actuals. A report can drill back to transactions.

## New User Onboarding

### 1. Start Local Stack

Run the local frontend and backend using the project dev script or the documented local commands.
If the UI shows the backend is offline, open `Workspace / Household > Settings > System` and use
`Check API again`.

### 2. Import Data

Open `Workspace / Household > Import data`.

Use this order:

1. Choose a Snoop CSV.
2. Preview row count, date range, detected accounts, categories, duplicates, and warnings.
3. Commit the import.
4. Run transfer detection.
5. Run recurring bill detection.

Expected result: accounts, transactions, candidate transfers, candidate bills, and freshness status
become available across the app.

### 3. Review Accounts

Open `Accounts`.

Set account types and enter current balances. The app can import movement from CSV, but it often
needs current balances to make cash-on-hand trustworthy.

Expected result: dashboard confidence and cash-flow forecasts become more useful.

### 4. Resolve Decisions

Open `Decision Queue`.

Confirm or reject:

- Internal transfer matches.
- Recurring bill candidates.

Expected result: reports stop double-counting transfers and future bills become more reliable.

### 5. Review Transactions

Open `Transactions`.

Filter by date, account, group, type, reviewed status, or search. Update transaction type/group when
needed and mark rows reviewed.

Expected result: budget actuals and reports reflect cleaner transaction meaning.

### 6. Plan And Monitor

Use:

- `Dashboard` for the daily briefing.
- `Budget` for planned vs actual money.
- `Cash Flow` for timing and what-if scenarios.
- `Calendar` for dated bills.
- `Goals` and `Sinking Funds` for saving and irregular obligations.
- `Reports` for patterns and exportable summaries.

## Primary Workflows

### Workflow A: First Import To Trusted Dashboard

1. Import CSV.
2. Commit import.
3. Detect transfers.
4. Detect bills.
5. Enter account balances.
6. Resolve Decision Queue.
7. Open Dashboard.

Success condition: no `Failed to fetch`, dashboard shows household position, bill totals, spending
pulse, and review focus.

### Workflow B: Weekly Money Review

1. Select `This month` or `Last 30 days`.
2. Open Decision Queue and clear high-impact items.
3. Open Transactions and review unreviewed rows.
4. Open Budget and compare planned vs actual.
5. Open Cash Flow and check lowest projected point.
6. Open Calendar and scan upcoming due dates.

Success condition: user knows what changed, what is due, what is over budget, and what is safe to spend.

### Workflow C: Bill And Subscription Review

1. Open Recurring.
2. Confirm or ignore recurring candidates.
3. Open Calendar to see dated impact.
4. Open Subscriptions for cancellation/renegotiation prompts.
5. Open Sinking Funds for annual/non-monthly obligations.

Success condition: expected obligations are visible before they hit the account.

### Workflow D: Budget Planning

1. Open Budget.
2. Choose category, flexible, or rollover mode.
3. Enter planned amounts.
4. Compare actual outflow and remaining budget.
5. Jump to Transactions when actuals need explanation.

Success condition: budget rows reconcile planned, actual, remaining, and status without hidden values.

### Workflow E: Cash Crunch Prevention

1. Open Cash Flow.
2. Check projected ending cash and lowest point.
3. Toggle candidate bills if planning conservatively.
4. Add what-if income/outflow scenario.
5. Compare scenario ending cash with baseline.

Success condition: user knows whether a decision creates future cash pressure.

### Workflow F: Spending Pattern Analysis

1. Open Reports.
2. Choose Cash Flow, Spending, or Income.
3. Switch grouping by category, merchant, summary, or income source.
4. Expand leaves such as Debt or Flexible to see merchant buckets.
5. Export CSV if needed.

Success condition: user can explain where money came from, where it went, and which merchants/categories dominate.

### Workflow G: Cleanup And Classification

1. Open Settings.
2. Use Merchants to merge or rename noisy merchant labels.
3. Use Rules to preview and apply classification changes.
4. Use Tags and Categories for local planning structure.
5. Reopen Reports and Transactions to verify cleaner grouping.

Success condition: reports become readable without corrupting raw imported transaction text.

## What End Users Should Expect

Users should expect:

- A local-first personal finance workspace.
- GBP-focused formatting.
- CSV import rather than live bank sync.
- Human review before important inferred changes.
- Better answers after balances, decisions, and transaction review are completed.
- Forecasts and budgets that are useful planning tools, not financial advice.
- Some settings stored locally in the browser until server-backed preference persistence is built.

Users should not expect yet:

- Automatic bank connections.
- Mobile app packaging.
- Cloud sync.
- Multi-user collaboration.
- Full business accounting.
- Investment portfolio management.
- Tax filing.
- AI that mutates finance data.

## User Benefits

- Less anxiety: key money questions are visible in one workspace.
- Better accuracy: transfers and bills are reviewed before they affect planning.
- Better timing: Calendar and Cash Flow expose due dates and cash-pressure points.
- Better discipline: Budget and Goals connect intent to actual imported data.
- Better clarity: Reports turn dense transaction history into patterns.
- Better privacy: data stays local-first rather than requiring a cloud finance provider.

## Complete End-To-End User Guide

### Day 0: Set Up

1. Start frontend and backend.
2. Confirm API status is online.
3. Import Snoop CSV.
4. Commit import.
5. Run transfer and recurring detection.
6. Enter balances.
7. Clear Decision Queue.

### Day 1: Understand Position

1. Open Dashboard.
2. Read household position and data freshness.
3. Check left-to-spend.
4. Check upcoming/recent bills.
5. Check review focus and open decisions.
6. Open Cash Flow if cash pressure looks high.

### Weekly: Review And Clean

1. Use `This month` or `Last 30 days`.
2. Review unreviewed transactions.
3. Confirm/ignore new bills and transfers.
4. Check Budget remaining.
5. Check Calendar due dates.
6. Export reports if needed.

### Monthly: Plan Forward

1. Open Monthly Review.
2. Check income, outflows, net, and review coverage.
3. Open Budget and adjust planned amounts.
4. Open Goals and update progress/contributions.
5. Open Sinking Funds and check irregular commitments.
6. Open Reports for spending/income patterns.

### Whenever Data Changes

1. Import a new CSV.
2. Commit it.
3. Rerun transfer and recurring detection.
4. Resolve new decisions.
5. Recheck Dashboard, Budget, and Cash Flow.

## Current Product Boundaries

The visible Household/Business switcher is a UI shell. Phase 2.1 must implement actual business
entity scoping, business imports, separate categories, and separate reports.

The Dashboard's `30-day after bills` metric is labelled as a 30-day backend summary. Future work
should make dashboard summary APIs fully date-window aware.

Local-first planning controls are useful, but some preferences remain browser-scoped. Future work
should add server-backed preference persistence and backup/export of settings.
