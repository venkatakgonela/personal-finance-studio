<!---
ai-eos-metadata:
  purpose: "Risk register for product, technical, and data-quality risks."
  how_to_use: "Review before implementation and update as risks change."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Risk Register - Personal Finance Studio

**Last reviewed:** 2026-06-16

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
| FreeAgent OAuth tokens leak | External finance data exposed | Encrypt tokens/client secret at rest, mask sensitive UI fields, strip bearer prefixes, exchange auth codes server-side, never log Authorization headers, keep `.gitignore` coverage for key files | Mitigated locally; full hosted callback remains future hardening |
| FreeAgent Business data mixes into Household views | Reporting and privacy errors | Entity-scope all FreeAgent records; keep Business context backend isolation as Phase 2.1 before broad Business use | Partially mitigated; records are entity-scoped but Business UI/data isolation remains future work |
| Overdraft capacity gives false confidence | User spends beyond safe headroom | Show available capacity and liability separately; Safe to Spend is cash-capped and assumptions live on Budget | Partially mitigated; requires user-entered overdraft limit and safety buffer discipline |
| Dashboard widget preferences are lost | User loses custom layout/widgets | Keep layout local-first for now; add server-backed preferences and backup/restore in Phase 2.1/3 | Open |
| Motion reduces accessibility or performance | UI feels distracting or hard to use | Use reduced-motion CSS, lightweight auto-animate, and browser smoke tests for overflow/drag behavior | Partially mitigated |
| Raw bank labels become planning labels | Calendar/Budget become hard to understand and users mistrust recurring items | Store editable commitment reference name/category separately from source label evidence; provide inline recurring edit flow | Mitigated for commitments; transaction merchant cleanup remains ongoing |
| Transaction advice suggests false recurring items | User may protect a one-off transaction and distort forecasts | Let users dismiss advice locally with `Not recurring`; keep imported transactions unchanged | Mitigated in Recurring UI |
