<!---
ai-eos-metadata:
  purpose: "Feature record for the Budget Control Tower redesign."
  how_to_use: "Consult before changing Budget workflow, safe-spend assumptions, or budget table interactions."
  generated_by: "Codex"
--->

# FEATURE-012 - Budget Control Tower

**Status:** Implemented locally  
**Date:** 2026-06-15

## Problem

The Budget page was financially accurate but too crowded. It exposed summary metrics, budget modes, formulas, safe-spend assumptions, and the editable category table in one stacked screen. That made the experience feel like a spreadsheet and increased the risk that users would treat period surplus as permission to spend.

## Design

Budget is now organized as a five-panel decision workflow:

- **Overview:** Kakeibo-style prompts: what do I have, what must be protected, what can I spend, and what should improve.
- **Monthly plan:** income, bills/subscriptions, savings goals, flexible actuals, period surplus, and budget mode selection.
- **Envelopes:** editable planned/actual/remaining category table, including rollover mode when selected.
- **Assumptions:** safe-spend inputs for expected income, one-off exclusions, known costs, lifestyle allowance, safety buffer, income confidence, lookback, and job-change flag.
- **Review:** actuals, reviewed/unreviewed counts, and next best actions.

## Principles

- Use envelope budgeting and mental accounting for category edits.
- Use Kakeibo reflection for the first-view questions.
- Use guardrail budgeting language: "safe to spend", "protected", and "next best action" instead of failure/shame framing.
- Keep Dashboard fact-led; keep Budget as the reasoning/editing workbench.

## Acceptance Criteria

- The Budget first view shows a spend boundary before editable category rows.
- Every workflow tab is reachable by mouse and keyboard.
- Budget mode controls remain available in Monthly plan.
- Envelopes still preserve planned, actual, rollover, remaining, and status fields.
- Assumption inputs still update the cash-capped Safe to Spend calculation.
- Review actions link to Transactions and Monthly Review.
- Browser smoke tests confirm no overflow, no unlabeled controls, and all workflow panels render.
