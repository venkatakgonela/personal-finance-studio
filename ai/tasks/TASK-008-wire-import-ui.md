# TASK-008: Wire Import UI

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Connect the React frontend to the backend import, account, transaction, and transfer APIs.

## 2. Context Files

- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-002-screen-and-design-system.md`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`

## 3. Checklist

- [x] Add frontend API client.
- [x] Add Snoop CSV preview workflow.
- [x] Add Snoop commit workflow.
- [x] Add transfer detection action.
- [x] Show account summaries.
- [x] Show transaction ledger excluding transfer candidates.
- [x] Add frontend tests for shell and preview state.

## 4. Verification

```bash
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```
