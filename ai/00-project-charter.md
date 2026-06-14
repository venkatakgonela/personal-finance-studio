<!---
ai-eos-metadata:
  purpose: "Foundational charter defining project mission, goals, non-goals, and stakeholders."
  how_to_use: "Read to align on project boundaries, goals, and key priorities."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Project Charter - Personal Finance Studio

**Owner:** Kiran Gonela  
**Type:** Local-first finance app
**Current Status:** Phase 1.75 Editable Planning Control Plane is implemented locally; Phase 2 household expansion is next.

## 1. Mission

Personal Finance Studio helps a household understand money across multiple accounts, weekly income, variable bills, credit cards, loans, BNPL, and unplanned spending.

The product should answer, clearly and calmly:

- What money exists right now?
- What is already committed?
- What is flexible and safe to spend?
- What bills are due today, this week, next 15 days, or any selected date?
- What bills were paid or expected in recent historical ranges?
- What will account balances look like after planned obligations?
- Which imported transactions need human decision because they affect future accuracy?

## 2. Goals

- Build a local-first Household finance command center using real Snoop CSV data.
- Keep the data model ready for separate Household and Business entities.
- Import transactions, accounts, categories, statuses, and balances where Snoop provides them.
- Detect internal transfers early so spending, income, and availability are not distorted.
- Detect and confirm recurring commitments, subscriptions, variable bills, loans, credit cards, and BNPL.
- Support flexible spending as a single useful dashboard number.
- Keep all Phase 1/1.5 household money views GBP-only.
- Expand Phase 2 into practical household controls: rule application, merchant cleanup, cashflow scenarios, budget modes, spending plan, and exports.
- Keep Business entity imports and read-only local assistant work separated into Phase 2.1 so household planning does not wait on business/LLM scope.
- Show actuals, estimates, forecasts, and pending data with distinct visual language.
- Keep the experience calm, useful, and low-noise.

## 3. Non-Goals

- No live Open Banking in Phase 1.
- No cloud sync in Phase 1.
- No mobile app in Phase 1.
- No investment tracking in Phase 1.
- No tax/accounting reports in Phase 1.
- No local LLM assistant as a Phase 1 or Phase 1.5 dependency.
- No automatic personal/business data mixing.

## 4. Success Metrics

- [x] Snoop CSV import processes the sample export without data loss.
- [x] Imported accounts can be classified and scoped to Household.
- [x] Internal transfers are detected, linked, and excluded from spend/income reporting.
- [x] Dashboard shows cash readiness, available after commitments, flexible spend remaining, upcoming obligations, and review counts.
- [x] Dashboard uses time-aware greeting, balance-readiness setup status, spending pulse, compact Decision Queue preview, and date-aware bill titles.
- [x] Calendar/bill views show bills, subscriptions, loans, credit-card payments, BNPL, income-style commitments, and candidates by selected date window.
- [x] Forecast can project account balances over selected windows.
- [x] Transactions can be filtered by date, account, normalized group, type, review state, posted status, and search.
- [x] Decision Queue stays focused on high-impact transfer and recurring-commitment decisions.
- [x] Quality gates cover backend logic, API filters, frontend unit tests, and browser E2E checks.

## 5. Users

- Primary user: Kiran, managing household finances.
- Future users/profiles: spouse, kids, household-level ownership, business entity.

## 6. Stakeholders

- Product Owner: Kiran Gonela
- Technical Lead: Codex-assisted development
