<!---
ai-eos-metadata:
  purpose: "Task-scoped context pack for future Monzo and Open Banking personal-bank connectors."
  how_to_use: "Load before designing or implementing direct bank, Open Banking, consent, or sync-health work."
  generated_by: "Codex Open Banking planning"
--->

# Context Pack: Personal Bank Connectors

## 1. Required Context

- [AGENTS.md](file:///AGENTS.md)
- [Architecture Design](file:///ai/01-architecture.md)
- [Domain Model](file:///ai/02-domain-model.md)
- [ADR-025: Use Direct Bank/Open Banking For Personal Banking Truth](file:///ai/04-decisions.md)
- [FEATURE-009: Open Banking And Sync Evaluation](file:///ai/features/FEATURE-009-open-banking-and-sync-evaluation.md)
- [Risk Register](file:///ai/08-risk-register.md)

## 2. Guardrails

- Do not screen-scrape bank websites or store online-banking passwords.
- Keep FreeAgent as accounting/business reference; do not treat FreeAgent balances as personal cash truth.
- Use explicit OAuth/Open Banking consent and store only encrypted tokens/consent references.
- Preserve CSV import as a fallback.
- Keep provider-specific payloads behind an app-owned connector abstraction.
- Do not ship multi-user account aggregation without an authorised provider/regulatory path.

## 3. Connector Direction

- **Monzo direct first:** accounts, balances, pots, transactions, transaction updates/webhooks, OAuth
  refresh, and consent visibility.
- **Open Banking aggregator second:** start evaluation with GoCardless Bank Account Data, then compare
  TrueLayer, Plaid, Yapily, Tink, Moneyhub, and Salt Edge for UK coverage, consent refresh, pricing,
  transaction quality, webhook support, and local-first compatibility.
- **Provider abstraction:** normalize into `ExternalBankConnector` methods for account discovery,
  balance refresh, transaction sync, cursor handling, consent status, and sync-health diagnostics.

## 4. Verification Expectations

- Mocked provider tests only; no real bank credentials or tokens in fixtures.
- Browser smoke tests must verify connect/status/sync states without exposing secrets.
- Migration tests must prove encrypted token/consent storage and per-account cursor behavior.
