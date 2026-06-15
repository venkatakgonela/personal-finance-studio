<!---
ai-eos-metadata:
  purpose: "Task record for Phase 2 household expansion."
  how_to_use: "Use as the implementation checklist for rule application, merchant cleanup, scenarios, budgets, spending plan, and exports."
  generated_by: "Codex implementation planning"
--->

# TASK-015: Phase 2 Household Expansion

**Status:** Complete locally  
**Started:** 2026-06-15
**Completed:** 2026-06-15

## Objective

Turn Phase 1.75's local-first planning controls into more useful household workflows without
disturbing the existing visual system. Phase 2 should make the app better at cleaning imported data,
planning ahead, comparing scenarios, understanding left-to-spend, and exporting useful reports.

Business entity imports and the local assistant are intentionally Phase 2.1, not Phase 2.

## Product Slice

1. **Rule Application Workflow**
   - Preview which transactions a rule would affect.
   - Apply rules to selected transactions or all matching transactions.
   - Track enough history to undo the last local rule application.
   - Never silently rewrite imported transaction meaning without a preview.

2. **Merchant Cleanup**
   - Add merchant aliases.
   - Merge duplicate merchant names into one display merchant.
   - Split a merchant where different descriptions should remain separate.
   - Keep the original imported merchant/description available for auditability.

3. **Cashflow Scenarios**
   - Add what-if income/outflow adjustments.
   - Compare baseline vs scenario for selected date windows.
   - Surface projected ending cash, lowest point, and pressure changes.

4. **Budget Modes**
   - Support category budgeting and flexible budgeting.
   - Add rollover handling for categories where unspent budget should carry forward.
   - Keep planned, actual, remaining, and rollover math visible.

5. **Spending Plan**
   - Show income minus bills, subscriptions, savings goals, and left-to-spend.
   - Align with existing Dashboard/Cash Flow cards so the user does not see competing numbers.

6. **Exports**
   - Export transactions, budget, monthly review, and reports as CSV.
   - Use selected filters/date windows where applicable.

## UI Constraints

- Preserve the current calm card, row, button, and table language.
- Keep Import and Settings in the bottom-left household/profile menu unless a daily-work route needs
  primary navigation.
- Avoid new decorative styles that compete with the existing teal/cream/ink system.
- Each new screen/control must have clear empty states and refresh-safe selections.

## Acceptance Criteria

- [x] Rule preview/apply/undo works without losing imported source values.
- [x] Merchant alias/merge/split controls affect display/report grouping without corrupting raw data.
- [x] Cashflow scenarios compare baseline and what-if outcomes.
- [x] Budget supports category, flexible, and rollover modes with auditable math.
- [x] Spending plan shows left-to-spend from income, bills, subscriptions, and goals.
- [x] CSV exports download useful filtered data.
- [x] Browser route health, layout overflow, and key Phase 2 flows are covered by E2E tests.
- [x] Backend and frontend quality gates pass.

## Delivered

- Added explicit rule impact preview, selected transaction apply, and latest-application undo in
  Settings > Rules.
- Added merchant display aliasing/merge, ignore/restore, and split-back-to-source behavior in
  Settings > Merchants.
- Updated Reports and Insights to use cleaned merchant display labels while preserving raw imported
  transaction text.
- Added flexible and rollover budget modes with rollover amount inputs and visible formulas.
- Added Dashboard Spending Plan: income minus bills/subscriptions, savings goals, and flexible spend.
- Added Cash Flow what-if scenarios with income/outflow adjustments and baseline comparison.
- Added Reports export controls for transactions, budget, monthly review, and category reports.
- Added backend normalization coverage so rule-applied group labels map to expected finance groups.

## Validation

Commands run successfully:

```bash
uv run pytest tests/test_phase2_household_expansion.py
cd frontend && npm run lint
cd frontend && npm run test -- --run
cd frontend && npm run build
cd frontend && npm run test:e2e -- --grep "phase 2 household|all primary routes"
```

## Phase 2.1 Boundary

Not included in this task:

- Business entity active UI.
- Tide CSV parser.
- NatWest Business CSV parser.
- Local LLM assistant.
