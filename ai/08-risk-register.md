<!---
ai-eos-metadata:
  purpose: "Risk register for product, technical, and data-quality risks."
  how_to_use: "Review before implementation and update as risks change."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Risk Register - Personal Finance Studio

**Last reviewed:** 2026-06-14

| Risk | Impact | Mitigation | Current Status |
|---|---|---|
| Internal transfers inflate spending/income | Dashboard becomes untrustworthy | Build transfer detection before insights/dashboard | Mitigated in Phase 1; candidates and confirmations implemented |
| Snoop export format changes | Import breaks | Validate columns, preview import, version parser | Partially mitigated; parser warnings and preview exist |
| Balances are absent or stale in export | Forecast starts from wrong value | Show balance readiness and allow manual edit | Partially mitigated; balance review exists, freshness UX still needed |
| Decision Queue becomes noisy | User loses interest | Only show high-impact decisions with suppression rules | Partially mitigated; transfer/commitment decisions exist, suppression/rules can improve |
| Credit cards/BNPL treated as spending only | Future obligations hidden | Model liabilities and dated repayments explicitly | Partially mitigated through account types and commitment modeling |
| Variable bills shown as exact | User trust drops | Label estimates clearly and reconcile actuals | Partially mitigated through expected/estimated/actual fields |
| Personal/business data mixed | Reporting and privacy errors | Mandatory entity scoping | Mitigated in data model; Business UI not started |
| LLM gives incorrect finance answer | Bad decisions | Keep LLM out of Phase 1; future LLM uses deterministic query results | Mitigated by deferral |
| Frontend runs while backend is down | User sees `Failed to fetch` and tests miss it | E2E checks FastAPI health before UI tests | Mitigated in Playwright config |
| Filters silently stop working | Ledger/reporting becomes misleading | Backend API filter tests and Playwright filter tests | Mitigated for current transaction filters |
| FreeAgent OAuth tokens leak | External finance data exposed | Store tokens only in approved local secret storage, never log tokens or Authorization headers, and keep sandbox-first development | Planned for Phase 3 |
| FreeAgent Business data mixes into Household views | Reporting and privacy errors | Entity-scope all FreeAgent records to Business and keep preview-only until Business scoping is confirmed | Planned for Phase 3 |
