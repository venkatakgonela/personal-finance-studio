<!---
ai-eos-metadata:
  purpose: "Foundational charter defining project mission, goals, non-goals, and stakeholders."
  how_to_use: "Read to align on project boundaries, goals, and key priorities."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Charter - Personal Finance Studio

**Owner:** Kiran Gonela  
**Type:** Local-first finance app

## 1. Mission

Personal Finance Studio helps a household understand money across multiple accounts, weekly income, variable bills, credit cards, loans, BNPL, and unplanned spending.

The product should answer, clearly and calmly:

- What money exists right now?
- What is already committed?
- What is flexible and safe to spend?
- What bills are due today, this week, next 15 days, or any selected date?
- What will account balances look like after planned obligations?
- Which imported transactions need human decision because they affect future accuracy?

## 2. Goals

- Build a local-first Household finance command center using real Snoop CSV data.
- Keep the data model ready for separate Household and Business entities.
- Import transactions, accounts, categories, statuses, and balances where Snoop provides them.
- Detect internal transfers early so spending, income, and availability are not distorted.
- Detect and confirm recurring commitments, subscriptions, variable bills, loans, credit cards, and BNPL.
- Support flexible spending as a single useful dashboard number.
- Show actuals, estimates, forecasts, and pending data with distinct visual language.
- Keep the experience calm, useful, and low-noise.

## 3. Non-Goals

- No live Open Banking in Phase 1.
- No cloud sync in Phase 1.
- No mobile app in Phase 1.
- No investment tracking in Phase 1.
- No tax/accounting reports in Phase 1.
- No local LLM assistant as a Phase 1 dependency.
- No automatic personal/business data mixing.

## 4. Success Metrics

- Snoop CSV import processes the sample export without data loss.
- Imported accounts can be classified and scoped to Household.
- Internal transfers are detected, linked, and excluded from spend/income reporting.
- Dashboard shows cash on hand, available after commitments, flexible spend remaining, and upcoming obligations.
- Calendar shows bills, subscriptions, loans, credit-card payments, BNPL, and income by date range.
- Forecast can project account balances over today, 7 days, 15 days, 30 days, and custom windows.
- Decision Queue remains small and high-impact.

## 5. Users

- Primary user: Kiran, managing household finances.
- Future users/profiles: spouse, kids, household-level ownership, business entity.

## 6. Stakeholders

- Product Owner: Kiran Gonela
- Technical Lead: Codex-assisted development
