# TASK-010: Dashboard, Calendar, and Account Review

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## Objective

Move Phase 1 from import-only setup toward a usable household finance dashboard by exposing
cash readiness, upcoming commitments, decision counts, and manual account balance review.

## Scope

- Add a dashboard summary API with available-money readiness signals.
- Add an upcoming commitments API for the next planning window.
- Add account update support for current balance and account type review.
- Prevent liability accounts from being counted as available cash.
- Wire the React dashboard to durable backend data after refresh.
- Add account review controls for entering current balances.
- Replace dashboard section anchors with distinct page routes.
- Align the implementation palette to the documented neutral/teal system.

## Acceptance Criteria

- [x] Dashboard reloads existing backend data without requiring a fresh CSV import.
- [x] Cash-on-hand is withheld until included cash accounts have current balances.
- [x] Credit cards, loans, and BNPL accounts cannot be counted as cash-on-hand.
- [x] Upcoming commitments show candidate and confirmed totals separately.
- [x] Account rows allow type and balance review from the UI.
- [x] Sidebar links navigate to distinct page routes.
- [x] Active navigation and controls use the same neutral/teal palette.
- [x] Backend tests cover dashboard, calendar, and account update behavior.
- [x] Frontend lint, tests, and production build pass.
- [x] Browser smoke test verifies safe navigation, search filtering, and account controls.
