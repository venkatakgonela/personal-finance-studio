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
- Budget is a control-tower workflow, not a single crowded table. Preserve the five sections: Overview, Monthly plan, Envelopes, Assumptions, and Review.
- Recurring is a commitment inbox. Preserve detection-review, transaction-backed creation, and
  manual-entry paths; finite BNPL/payment plans need either a payment count or an end date.
- Transactions is also an evidence-entry point: eligible posted outflows should expose a direct
  `Make recurring` action that opens a review form before creating the commitment.
- Recurring commitment forms must separate user-friendly reference naming from source evidence,
  and include an editable category so raw bank labels do not become the household planning model.
- Commitment category inputs should offer the curated household taxonomy: utilities, council tax,
  vehicle costs, insurance, education/childcare, family support, healthcare, credit cards, BNPL,
  subscriptions, and annual/irregular costs. Show this as a visible suggested-category dropdown
  next to the editable text field; do not rely only on browser datalist behavior.
- Detected recurring candidate edit state should use the compact two-column review pattern:
  header with source/amount/actions, uniform field cells, `Budget category` instead of generic
  category, and `Payment kind` instead of technical type.
- Recurring rows must support editing the planning amount for variable obligations such as credit
  cards. Transaction advice must support `Not recurring` dismissal without changing imported
  transactions.
- Use `prefers-reduced-motion` protections when adding new motion.

## 5. Verification

- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e` for route/workflow changes.
- Browser smoke for dashboard motion should check overlay presence during drag, order after drop, and no horizontal overflow.
