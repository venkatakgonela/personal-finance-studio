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
- `frontend/package.json` and `frontend/package-lock.json` for UI library decisions.
- `frontend/src/App.test.tsx`
- `frontend/e2e/app.spec.ts`

## 4. Current UI Architecture Notes

- Dashboard widgets use `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`.
- Dashboard widget customization lives in `Settings > Dashboard`; Dashboard itself should remain fact-led and avoid configuration panels in prime content.
- Dashboard sorting uses a small floating `Arrange` handle, `DragOverlay`, keyboard/pointer sensors, and local-first widget order/visibility/custom widget preferences.
- Small list/collapsible transitions use `@formkit/auto-animate`; prefer applying it to stable parent containers rather than adding bespoke animation state.
- Safe-spend assumptions belong on Budget, not Dashboard. Dashboard may show Safe to Spend and link to assumption tuning.
- Use `prefers-reduced-motion` protections when adding new motion.

## 5. Verification

- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e` for route/workflow changes.
- Browser smoke for dashboard motion should check overlay presence during drag, order after drop, and no horizontal overflow.
