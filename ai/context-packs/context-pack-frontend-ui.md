<!---
ai-eos-metadata:
  purpose: "Task-scoped context pack for React UI, CSS, product workflow, and browser tests."
  how_to_use: "Load for frontend route, layout, report, form, filter, or E2E changes."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# Context Pack: Frontend UI

## 1. Required Context

- [AGENTS.md](file:///AGENTS.md)
- [Architecture](file:///ai/01-architecture.md)
- [Repo Map](file:///ai/03-repo-map.md)
- [SPEC-002: Screen And Design System](file:///ai/specs/SPEC-002-screen-and-design-system.md)
- Relevant feature/task file under `ai/features/` or `ai/tasks/`.

## 2. Add When Relevant

- [PRODUCT_GUIDE](file:///ai/PRODUCT_GUIDE.md) for product workflows and user expectations.
- [HOW_TO_USE](file:///ai/HOW_TO_USE.md) for operational flows.
- [SPEC-003: Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md) for route-health, browser, and regression criteria.
- [UI Change Skill](file:///ai/skills/ui-change.md) for CSS/layout/test expectations.

## 3. Source Areas

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/styles.css`
- `frontend/src/App.test.tsx`
- `frontend/e2e/app.spec.ts`

## 4. Verification

- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e` for route/workflow changes.
