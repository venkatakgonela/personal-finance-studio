# TASK-004: Bootstrap Implementation Foundation

**Status:** Complete  
**Assigned To:** Codex  
**Created Date:** 2026-06-14

## 1. Goal

Create the first implementation foundation for Personal Finance Studio without skipping the planning constraints.

## 2. Context Files

- `AGENTS.md`
- `ai/specs/SPEC-001-phase-1-household-snoop.md`
- `ai/specs/SPEC-002-screen-and-design-system.md`
- `ai/specs/SPEC-003-testing-strategy.md`

## 3. Checklist

- [x] Add FastAPI backend shell.
- [x] Add Snoop CSV preview service.
- [x] Add Snoop CSV fixture tests.
- [x] Add API smoke tests.
- [x] Add React + Vite frontend shell.
- [x] Add frontend unit test foundation.
- [x] Add Docker Compose PostgreSQL config.
- [x] Document local dev commands.

## 4. Verification

```bash
uv run ruff check .
uv run pytest
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm audit --audit-level=high
```
