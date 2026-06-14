<!---
ai-eos-metadata:
  purpose: "Risk register for product, technical, and data-quality risks."
  how_to_use: "Review before implementation and update as risks change."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Risk Register - Personal Finance Studio

| Risk | Impact | Mitigation |
|---|---|---|
| Internal transfers inflate spending/income | Dashboard becomes untrustworthy | Build transfer detection before insights/dashboard |
| Snoop export format changes | Import breaks | Validate columns, preview import, version parser |
| Balances are absent or stale in export | Forecast starts from wrong value | Show balance freshness and allow manual edit |
| Decision Queue becomes noisy | User loses interest | Only show high-impact decisions with suppression rules |
| Credit cards/BNPL treated as spending only | Future obligations hidden | Model liabilities and dated repayments explicitly |
| Variable bills shown as exact | User trust drops | Label estimates clearly and reconcile actuals |
| Personal/business data mixed | Reporting and privacy errors | Mandatory entity scoping |
| LLM gives incorrect finance answer | Bad decisions | Keep LLM out of Phase 1; future LLM uses deterministic query results |
