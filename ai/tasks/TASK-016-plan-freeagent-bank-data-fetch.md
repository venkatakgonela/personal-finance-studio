<!---
ai-eos-metadata:
  purpose: "Planning task for FreeAgent bank account balance and transaction fetching."
  how_to_use: "Use as the implementation-readiness checklist before coding FreeAgent integration."
  generated_by: "Codex FreeAgent API planning"
--->

# TASK-016: Plan And Implement FreeAgent Bank Data Fetch

**Status:** Complete  
**Assigned To:** Kiran Gonela  
**Created Date:** 2026-06-15

## 1. Goal

Plan and implement a read-only FreeAgent API integration that can validate supplied OAuth details,
list bank accounts, store secrets encrypted, and import bank balances/transactions for a selected
FreeAgent bank account.

## 2. Scope

- **In scope:** Manual-token OAuth validation, sandbox/production/custom URL configuration, encrypted
  secret storage, read-only account/transaction fetch flow, incremental import cursor, UI screen,
  backend services/routes/migration, mocked tests.
- **Out of scope:** Browser OAuth callback, FreeAgent write operations, statement upload, transaction
  explanation mutation, production credential setup.

## 3. Context Files

Load the smallest sufficient context set.

- **Required:**
  - [AGENTS.md](file:///AGENTS.md)
  - [Context Pack: FreeAgent API](file:///ai/context-packs/context-pack-freeagent-api.md)
  - [FEATURE-010: FreeAgent Bank Data Fetch](file:///ai/features/FEATURE-010-freeagent-bank-data-fetch.md)
  - [SPEC-004: FreeAgent Bank Data Fetch](file:///ai/specs/SPEC-004-freeagent-bank-data-fetch.md)
- **Optional:**
  - [Domain Model](file:///ai/02-domain-model.md)
  - [Testing Strategy](file:///ai/specs/SPEC-003-testing-strategy.md)
  - [Risk Register](file:///ai/08-risk-register.md)

## 4. Prerequisites

- [x] FreeAgent sandbox or production account exists.
- [x] FreeAgent company setup is complete enough for API reads.
- [x] FreeAgent Developer Dashboard app exists.
- [x] Postman read-only collection is imported from `postman/freeagent-readonly.postman_collection.json`.
- [x] Postman environment is duplicated from `postman/freeagent-template.postman_environment.json`
  before adding secrets.
- [x] OAuth client ID, secret, and access token are available locally.
- [x] OAuth authorization and token endpoint have been verified manually.
- [x] Local token storage is encrypted via `PFS_SECRET_KEY` or ignored `data/.pfs_secret.key`.

## 5. Proposed Flow

1. User opens `#/freeagent`.
2. User chooses production, sandbox, or custom/mock URL.
3. User enters client ID, client secret, access token, and optional refresh token.
4. Backend encrypts secrets and validates with `GET /v2/company` and `GET /v2/bank_accounts`.
5. UI shows validation status and active accounts with current balance and latest activity date.
6. User selects the desired FreeAgent bank account.
7. User chooses incremental cursor mode or a date window.
8. Backend calls `GET /v2/bank_transactions?bank_account=:bank_account` with selected filters.
9. Backend imports provider-tagged accounts/transactions, skips duplicate fingerprints, and updates
   the next `updated_since` cursor.

## 6. Acceptance Criteria

- [x] FreeAgent endpoint and OAuth process are documented.
- [x] Tests cover service, API route, encryption, mocked account listing, import, dedupe, and cursor behavior.
- [x] Read-only guardrail is explicit.
- [x] Token and credential handling rules are explicit.
- [x] UI supports validation status and guided incremental import questions.

## 7. Verification

- `uv run ruff check app tests`
- `uv run pytest`
- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `UV_CACHE_DIR=/private/tmp/pfs-uv-cache DATABASE_URL=sqlite:////private/tmp/pfs-freeagent-migration.sqlite uv run alembic upgrade head`
