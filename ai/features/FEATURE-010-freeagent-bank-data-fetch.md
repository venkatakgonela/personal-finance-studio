<!---
ai-eos-metadata:
  purpose: "Feature record for planned read-only FreeAgent bank account and transaction fetching."
  how_to_use: "Use when planning or implementing FreeAgent API integration work."
  generated_by: "Codex FreeAgent API planning"
--->

# FEATURE-010: FreeAgent Bank Data Fetch

**Epic:** [EPIC-004: Integrations And Hardening](file:///ai/epics/EPIC-004-integrations-and-hardening.md)  
**Status:** Implemented - manual OAuth token phase  

## 1. Description & User Stories

- **Description:** Add a read-only FreeAgent API integration that can fetch bank accounts, current
  balances, and bank transactions for a selected FreeAgent bank account.
- **As a** business finance user **I want to** connect FreeAgent and select a bank account **so that**
  Personal Finance Studio can import balances and transactions without manual CSV export.

## 2. Acceptance Criteria

- [x] User can configure sandbox, production, or custom/mock FreeAgent API mode without hard-coding credentials.
- [x] OAuth client secret, access token, and refresh token are encrypted at rest and never committed.
- [x] Bank accounts can be listed from `GET /v2/bank_accounts`.
- [x] Current balance is read from the FreeAgent `current_balance` bank account field.
- [x] A desired account can be selected by its FreeAgent bank account URL.
- [x] Bank transactions can be fetched with `GET /v2/bank_transactions?bank_account=:bank_account`.
- [x] Date-window and incremental fetch parameters are supported: `from_date`, `to_date`, and
  `updated_since`.
- [x] Transaction fetch is read-only and never uploads, deletes, explains, or mutates FreeAgent data.
- [x] FreeAgent records are provider-tagged and deduplicated independently from Snoop imports.
- [x] UI masks client secret, access token, and refresh token by default and explains that refresh token is optional but distinct from access token.
- [x] Access/refresh token values are normalized when users paste `Bearer ...` or header-shaped values.
- [ ] Full browser OAuth callback and token exchange are not implemented yet; this phase uses manually obtained tokens.
- [ ] Pre-commit transaction preview is not implemented yet; the UI asks account/date/incremental questions before import.
- [ ] Automatic token refresh UX is not implemented yet.

## 3. Source Artifacts

- [SPEC-004: FreeAgent Bank Data Fetch](file:///ai/specs/SPEC-004-freeagent-bank-data-fetch.md)
- [TASK-016: Plan FreeAgent Bank Data Fetch](file:///ai/tasks/TASK-016-plan-freeagent-bank-data-fetch.md)
- [Context Pack: FreeAgent API](file:///ai/context-packs/context-pack-freeagent-api.md)
- `app/routes/freeagent.py`
- `app/services/freeagent_client.py`
- `app/services/freeagent_import.py`
- `app/services/secret_store.py`
- `app/models/integration.py`
- `frontend/src/App.tsx` FreeAgent route/card
- [FreeAgent Quick Start](https://dev.freeagent.com/docs/quick_start)
- [FreeAgent OAuth](https://dev.freeagent.com/docs/oauth)
- [FreeAgent Bank Accounts](https://dev.freeagent.com/docs/bank_accounts)
- [FreeAgent Bank Transactions](https://dev.freeagent.com/docs/bank_transactions)

## 4. Verification

- `uv run ruff check app tests`
- `uv run pytest`
- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `UV_CACHE_DIR=/private/tmp/pfs-uv-cache DATABASE_URL=sqlite:////private/tmp/pfs-freeagent-migration.sqlite uv run alembic upgrade head`
