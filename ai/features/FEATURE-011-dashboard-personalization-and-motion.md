<!---
ai-eos-metadata:
  purpose: "Feature record for dashboard widgets, motion, and local personalization."
  how_to_use: "Use when changing dashboard layout, widget behavior, or frontend motion libraries."
  generated_by: "Codex dashboard personalization implementation"
--->

# FEATURE-011: Dashboard Personalization And Motion

**Epic:** [EPIC-002: Planning And Reporting Depth](file:///ai/epics/EPIC-002-planning-and-reporting-depth.md)  
**Status:** Implemented - local-first preferences

## 1. Description & User Stories

- **Description:** Let users personalize Dashboard layout without making Dashboard itself a settings
  workbench. Widget order, visibility, and custom widgets are local-first browser preferences.
- **As a** household finance user **I want to** arrange the Dashboard around my current priorities
  **so that** the first screen reflects how I review money decisions.

## 2. Design Decisions

- Dashboard content remains fact-led. Configuration lives in `Settings > Dashboard`.
- Widgets use their own card titles; the drag affordance is a small floating `Arrange` grip so the
  UI does not show duplicate labels like `Cash Position` above `Cash Position`.
- Sorting uses `dnd-kit` with pointer and keyboard sensors, `DragOverlay`, always-on measuring, and
  grid swap behavior.
- The original card fades to a placeholder while the overlay moves, reducing visual smearing for
  tall uneven dashboard cards.
- Compact list/collapsible transitions use `@formkit/auto-animate` for low-risk smoothness.
- Reduced-motion preferences must be respected.

## 3. Acceptance Criteria

- [x] User can reorder dashboard widgets with the arrange handle.
- [x] User can hide/show widgets from Settings.
- [x] User can add custom dashboard widgets with title, optional value, and note.
- [x] User can reset dashboard layout from Settings.
- [x] Dashboard customization controls do not occupy prime Dashboard space.
- [x] Reordering is saved locally.
- [x] Drag overlay appears during widget movement and disappears on drop.
- [x] Browser smoke confirms no horizontal overflow.

## 4. Source Areas

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/package.json`
- `frontend/package-lock.json`
- [ADR-020](file:///ai/04-decisions.md)

## 5. Verification

- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm run test -- --run`
- `uv run pytest`
- Browser smoke: drag a widget, verify overlay + placeholder during drag, verify final order, verify
  no horizontal overflow.
