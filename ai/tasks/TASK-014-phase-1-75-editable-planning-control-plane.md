<!---
ai-eos-metadata:
  purpose: "Task record for Phase 1.75 editable planning controls."
  how_to_use: "Use as the implementation checklist for the goals, budget, settings, import, dashboard, and cashflow slice."
  generated_by: "Codex implementation planning"
--->

# TASK-014: Phase 1.75 Editable Planning Control Plane

**Status:** Complete locally  
**Started:** 2026-06-15
**Completed:** 2026-06-15

## Objective

Move Personal Finance Studio from derived planning insights to an editable local planning product.
The user should be able to create goals, maintain budget assumptions, manage the finance taxonomy,
import fresh data, and understand household cash pressure from Dashboard and Cash Flow without
having to infer what to do next.

## Product Slice

1. **Goals**
   - Add a custom goal form.
   - Edit existing custom goals.
   - Delete custom goals.
   - Keep derived emergency/review goals visible, clearly labelled as derived.
   - Show target, current, monthly contribution, due date/status, and progress.

2. **Budget**
   - Add `#/budget` and primary nav.
   - Show monthly planned, actual, and remaining values.
   - Allow planned amounts to be edited by group/category.
   - Summarize total income, planned spend, actual spend, remaining, and over/under status.
   - Make budget math auditable in the UI.

3. **Settings Workbench**
   - Replace settings as status-only with sections for System, Categories, Merchants, Rules, Tags, and Data.
   - Categories: create/edit/delete groups/categories.
   - Tags: create/edit/delete colored tags.
   - Rules: create/edit/delete simple deterministic recategorization/tagging rules.
   - Merchants: show imported merchants, allow display/category edits and local deletes/ignores.

4. **Import Center**
   - Add a visible import/data route.
   - Support choose CSV, preview, commit, detect transfers, and detect recurring bills from one place.
   - Replace passive `Local data` label with an action/status control that opens the import/data screen.

5. **Cash Flow**
   - Upgrade the page from readiness metrics to a planning view.
   - Show projected balance, income, confirmed/candidate obligations, flexible spend pressure,
     lowest projected balance, and the next dated obligations.
   - Keep candidate toggle and date-window behavior consistent with Calendar and Dashboard.

6. **Dashboard**
   - Add useful planning value without crowding.
   - Include quick visibility into budget remaining, active goals, next bills, decision count, data freshness,
     and cashflow risk.
   - Avoid duplicating the same money number in multiple cards.

## Local Persistence Decision

Phase 1.75 may store user-authored goals, budgets, categories, tags, rules, and merchant display
preferences in browser local storage as a local-first bridge. This is acceptable only if:

- Imported transaction/account/commitment totals remain backend-derived.
- Budget actuals are calculated from current insights/transactions, not manually faked.
- User-authored values survive browser refresh.
- The UI labels locally stored preferences clearly as local planning settings.

Server persistence and rule-application history should move to Phase 2 if the local-first workflow
proves useful.

## Acceptance Criteria

- [x] Goals route supports add, edit, delete, and refresh-persistent custom goals.
- [x] Budget route supports editable plan rows and shows correct planned/actual/remaining totals.
- [x] Settings route supports CRUD-style interactions for categories, tags, rules, and merchants.
- [x] Import route exists and is discoverable from nav and the top data action.
- [x] Dashboard and Cash Flow expose more decision value while staying readable at desktop and mobile widths.
- [x] `Local data` is no longer a passive label.
- [x] Full validation passes:
  - `uv run ruff check app tests`
  - `uv run pytest`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`

## Delivered

- Added `#/budget` and `#/import` routes to the primary navigation.
- Added local-first editable planning preferences for goals, budget rows, categories, tags, rules, and merchant display settings.
- Added custom goal add/edit/delete with local refresh persistence.
- Added budget planned/actual/remaining table and summary totals using backend insight actuals.
- Added Settings workbench sections for Categories, Merchants, Rules, Tags, Data, and System Status.
- Replaced passive topbar `Local data` label with an `Import data` action.
- Added Dashboard Planning Snapshot.
- Added Cash Flow Plan with projected ending cash, lowest point, cash pressure, and dated events.
- Added Phase 1.75 E2E coverage.
- Removed duplicated status chrome after UI review:
  - `Import Freshness` now lives only in the Import Center.
  - `System Status` now lives only in Settings.
- Refined dashboard, settings, goals, and budget layout so Phase 1.75 controls follow the same card,
  form, and navigation rhythm as the rest of the app.

## Validation

Commands run successfully:

```bash
uv run ruff check app tests
uv run pytest
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm run test:e2e
```

Browser note: the in-app Browser surface was unavailable in this session, and a separate sandboxed
Chromium visual-inspection attempt was blocked by local browser process permissions. The Playwright
E2E suite still ran successfully against Chromium and covers route health, overflow, and the new
Phase 1.75 user flows.

Post-polish validation also passed:

```bash
uv run ruff check app tests
uv run pytest
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run test:e2e
```

## Phase 2 Candidates Discovered During Planning

- Persist planning controls server-side with migrations and API endpoints.
- Add preview/apply/undo for rules.
- Add merchant aliases and merge/split workflow.
- Add rollover budgets, flexible budget mode, and spending-plan mode.
- Add long-range cashflow scenarios and what-if modelling.
- Add business imports and entity-specific categories.
- Add read-only local assistant grounded in deterministic app queries.
