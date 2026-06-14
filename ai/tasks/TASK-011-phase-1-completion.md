# TASK-011: Phase 1 Completion

## Objective

Finish the local Household/Snoop Phase 1 control center so it supports import, review,
forecasting, recurring bills, transaction cleanup, and useful dashboard/route views end to end.

## Scope

- Add deterministic category normalization for reporting and flexible-spend calculations.
- Add transaction review actions for type changes and reviewed state.
- Add commitment update and bill-instance paid actions.
- Add cashflow forecast API with starting cash, projected ending cash, low point, and events.
- Add basic insights API for category groups and top merchants.
- Expand dashboard summary with available-after-commitments and flexible-spend values.
- Wire route pages to the new APIs.
- Keep Phase 1 local and deterministic; no Open Banking, no LLM assistant, no cloud sync.

## Acceptance Criteria

- [x] Transactions can be reviewed and reclassified.
- [x] Category groups are derived consistently from source category, merchant, and transaction type.
- [x] Internal transfers and ignored rows are excluded from insights.
- [x] Confirmed commitments affect projected balance; candidates remain visible but separate.
- [x] Planned bill instances can be marked paid with actual amount/date.
- [x] Dashboard shows cash-on-hand, available after commitments, flexible spend, and review counts.
- [x] Route pages expose Accounts, Transactions, Cash Flow, Recurring, and Decision Queue separately.
- [x] Backend completion tests cover transaction review, forecast, bill payment, and insights.
- [x] Frontend lint/test/build and backend ruff/pytest pass.
