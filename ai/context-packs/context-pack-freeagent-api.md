<!---
ai-eos-metadata:
  purpose: "Task-scoped context pack for implemented FreeAgent read-only banking integration."
  how_to_use: "Load before maintaining FreeAgent OAuth-token validation, bank account, or bank transaction import work."
  generated_by: "Codex FreeAgent API planning"
--->

# Context Pack: FreeAgent API

## 1. Required Context

- [AGENTS.md](file:///AGENTS.md)
- [FEATURE-010: FreeAgent Bank Data Fetch](file:///ai/features/FEATURE-010-freeagent-bank-data-fetch.md)
- [SPEC-004: FreeAgent Bank Data Fetch](file:///ai/specs/SPEC-004-freeagent-bank-data-fetch.md)
- [TASK-016: Plan FreeAgent Bank Data Fetch](file:///ai/tasks/TASK-016-plan-freeagent-bank-data-fetch.md)
- [EPIC-004: Integrations And Hardening](file:///ai/epics/EPIC-004-integrations-and-hardening.md)

## 2. Add When Relevant

- [Backend Data Context](file:///ai/context-packs/context-pack-backend-data.md) for adapter, service, route, schema, or migration work.
- [Frontend UI Context](file:///ai/context-packs/context-pack-frontend-ui.md) for connection, account-selection, preview, or settings UI.
- [Domain Model](file:///ai/02-domain-model.md) for entity scoping and external account identity.
- [Architecture Decisions](file:///ai/04-decisions.md) for local-first and integration boundaries.
- [Risk Register](file:///ai/08-risk-register.md) for credential, privacy, sync, and data-mixing risks.
- [Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md) for integration and browser coverage.

## 3. External Docs

- FreeAgent Quick Start: `https://dev.freeagent.com/docs/quick_start`
- FreeAgent OAuth: `https://dev.freeagent.com/docs/oauth`
- FreeAgent Bank Accounts: `https://dev.freeagent.com/docs/bank_accounts`
- FreeAgent Bank Transactions: `https://dev.freeagent.com/docs/bank_transactions`

## 4. Guardrails

- Read-only first: use `GET` endpoints only.
- Never log OAuth access tokens, refresh tokens, client secret, or raw Authorization headers.
- Keep sandbox and production base URLs explicit and user-selectable.
- Treat FreeAgent account URL and transaction URL/transaction ID as external identifiers for dedupe.

## 5. Current Implementation

- Backend: `app/routes/freeagent.py`, `app/services/freeagent_client.py`,
  `app/services/freeagent_import.py`, `app/services/secret_store.py`.
- Persistence: `integration_connections` stores encrypted client secret/tokens and import cursor;
  FreeAgent account/transaction rows use existing `accounts`, `transactions`, and `import_logs`.
- Frontend: `#/freeagent` route in `frontend/src/App.tsx`.
- Tests: `tests/test_freeagent_import.py` uses a mock FreeAgent client; no live API calls in CI.
