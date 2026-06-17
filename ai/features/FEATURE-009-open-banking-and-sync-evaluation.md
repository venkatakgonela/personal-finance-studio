<!---
ai-eos-metadata:
  purpose: "Feature record for optional Open Banking and sync-health evaluation."
  how_to_use: "Use when planning Phase 3 integrations."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-009: Open Banking And Sync Evaluation

**Epic:** [EPIC-004: Integrations And Hardening](file:///ai/epics/EPIC-004-integrations-and-hardening.md)  
**Status:** Planned - Monzo direct and Open Banking aggregator path selected  

## 1. Description & User Stories

- **Description:** Add a safer personal-banking source of truth by evaluating direct Monzo API
  access and an Open Banking aggregator for non-Monzo UK accounts. FreeAgent remains useful for
  accounting/business reference, but should not be treated as authoritative for personal bank
  balances because its figures can depend on bookkeeping reconciliation.
- **As a** user **I want to** reduce manual import effort only if privacy and reliability remain
  acceptable **so that** convenience does not undermine trust.

## 2. Acceptance Criteria

- [ ] Provider evaluation covers consent, refresh constraints, security, coverage, cost, and
  local-first impact.
- [ ] Monzo direct connector is evaluated first for accounts, balances, pots, transactions, and
  webhooks.
- [ ] Open Banking aggregator shortlist compares GoCardless Bank Account Data, TrueLayer, Plaid,
  Yapily, Tink, Moneyhub, and Salt Edge.
- [ ] App-owned connector abstraction is designed before implementation:
  `ExternalBankConnector -> accounts, balances, transactions, consent status, cursor, sync health`.
- [ ] Sync health, stale connection warnings, and audit trails are designed before implementation.
- [ ] CSV import remains available as a fallback.
- [ ] Open Banking remains explicitly approved and out of default scope until selected.
- [ ] Regulatory posture is documented: personal/local use may use developer/personal consent
  flows; any multi-user/commercial aggregation requires an authorised provider or an FCA AISP path.

## 3. Recommended Implementation Sequence

1. Keep FreeAgent read-only and reposition it as accounting/business reference.
2. Add a provider-neutral integration model for account consent, sync cursor, last sync status, and
   balance freshness.
3. Implement Monzo direct OAuth/API as the first personal-bank connector.
4. Prototype one Open Banking aggregator connector, with GoCardless Bank Account Data as the first
   candidate unless coverage/commercial needs push TrueLayer/Plaid/Yapily instead.
5. Reuse the existing transaction normalization, dedupe, account balance semantics, and review
   workflows.
6. Add browser and mocked-provider tests; never store real bank credentials or tokens in fixtures.

## 4. Source Artifacts

- [New Enhancements Backlog](file:///ai/new-enhancements.md)
- [Observability](file:///ai/07-observability.md)
- [Risk Register](file:///ai/08-risk-register.md)
- [ADR-025: Use Direct Bank/Open Banking For Personal Banking Truth](file:///ai/04-decisions.md)
