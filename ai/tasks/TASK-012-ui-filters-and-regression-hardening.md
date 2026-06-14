# TASK-012: UI Filters And Regression Hardening

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Close the usability gaps discovered after Phase 1 completion: missing date/filter controls,
awkward table layouts, stale local API confusion, and insufficient browser regression coverage.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-002-screen-and-design-system.md`
- `ai/specs/SPEC-003-testing-strategy.md`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/styles.css`
- `frontend/e2e/app.spec.ts`
- `frontend/playwright.config.ts`
- `app/routes/transactions.py`
- `app/services/transactions.py`
- `tests/test_api.py`
- `tests/test_accounts_transactions.py`

## 3. Checklist

- [x] Add global date-window controls with presets and custom dates.
- [x] Route date windows through transactions, calendar/upcoming, forecast, and insights calls.
- [x] Add transaction filters for account, category group, transaction type, review state, and posted status.
- [x] Fix transaction type mismatch between UI `Expense` and backend `spending`.
- [x] Make backend transaction filtering apply date, account, group, type, status, reviewed, and search params.
- [x] Add Calendar and Reports routes to match the planned navigation model.
- [x] Convert Transactions into a scannable table-like ledger on desktop with card collapse on mobile.
- [x] Convert Decision Queue into a scannable review table on desktop with mobile-friendly actions.
- [x] Add spacing between Decision Queue summary pills and the review table.
- [x] Configure Playwright E2E to require both FastAPI and Vite.
- [x] Add browser tests for real-stack fetch health, transaction filters, Decision Queue desktop layout, and Decision Queue mobile actions.
- [x] Add backend API tests for transaction filter behavior.

## 4. Verification

```bash
uv run ruff check .
uv run pytest
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test
cd frontend && npm run test:e2e
```

Latest verified results:

- Backend: 34 pytest tests passed.
- Frontend unit: 2 Vitest tests passed.
- Browser E2E: 5 Playwright tests passed.
- Ruff, ESLint, and production build passed.

## 5. Notes

- The earlier `Failed to fetch` banner was caused by the frontend running while the backend API on
  `127.0.0.1:8025` was stopped. Playwright now checks API health before E2E runs.
- The app is still a local-first dev-server app; packaging/installer work is not started.
