<!---
ai-eos-metadata:
  purpose: "Planning specification for read-only FreeAgent bank account balances and transactions."
  how_to_use: "Read before implementing FreeAgent API integration."
  generated_by: "Codex FreeAgent API planning"
--->

# SPEC-004: FreeAgent Bank Data Fetch

**Author:** Kiran Gonela / Codex  
**Status:** Implemented - manual OAuth token phase  
**Date:** 2026-06-15  

## 1. Problem Statement

Personal Finance Studio currently imports household data from Snoop CSV. The next integration step is
to evaluate FreeAgent as a read-only source for Business bank account balances and bank transactions.
The first slice should fetch enough data to preview and eventually import Business bank activity
without writing anything back to FreeAgent.

## 2. FreeAgent API Findings

### Authentication

FreeAgent uses OAuth 2.0. Development can start with a sandbox account and a registered app in the
FreeAgent Developer Dashboard. The sandbox OAuth endpoints are:

- Authorization: `https://api.sandbox.freeagent.com/v2/approve_app`
- Token: `https://api.sandbox.freeagent.com/v2/token_endpoint`

Production uses the same paths on `https://api.freeagent.com`. API requests use:

```http
Authorization: Bearer TOKEN
```

Access tokens are returned with refresh tokens and an expiry; refresh should happen on next use after
expiry rather than requiring manual re-authorization every time.

### Bank Accounts And Balances

Use:

```http
GET https://api.freeagent.com/v2/bank_accounts
GET https://api.freeagent.com/v2/bank_accounts/:id
```

Useful bank account fields:

- `url`: stable FreeAgent bank account identifier.
- `type`: for example `StandardBankAccount`, `CreditCardAccount`, or `EcommerceAccount`.
- `name`: account display name.
- `currency`: account currency.
- `is_personal`: whether FreeAgent treats the account as personal.
- `status`: `active` or `hidden`.
- `bank_name`: bank label where available.
- `opening_balance`: opening balance.
- `current_balance`: latest balance.
- `latest_activity_date`: date of latest transaction or bank account entry.
- `updated_at`: bank account update timestamp.

Process for fetching account balances:

1. Authorize with OAuth and obtain/refresh an access token.
2. Call `GET /v2/bank_accounts`, optionally filtered by view:
   - `standard_bank_accounts`
   - `credit_card_accounts`
   - `paypal_accounts`
3. Present active accounts to the user with name, type, currency, bank name, current balance, and
   latest activity date.
4. Store the selected FreeAgent `bank_account.url` as the external account identifier.
5. For the selected account, use either the list response or `GET /v2/bank_accounts/:id` to read
   `current_balance`.
6. Normalize the balance into a local preview model before committing any local account/balance
   records.

### Bank Transactions

Use:

```http
GET https://api.freeagent.com/v2/bank_transactions?bank_account=:bank_account
```

The `bank_account` query parameter is the FreeAgent bank account URL. Supported filters include:

- `from_date=YYYY-MM-DD`
- `to_date=YYYY-MM-DD`
- `updated_since=YYYY-MM-DDTHH:MM:SS.sssZ`
- `view=all|unexplained|explained|manual|imported|marked_for_review`
- `last_uploaded=true`

Useful bank transaction fields:

- `url`: stable FreeAgent bank transaction identifier.
- `amount`: signed transaction amount in the company's native currency.
- `bank_account`: FreeAgent bank account URL.
- `dated_on`: transaction date.
- `description`: free-text description.
- `full_description`: expanded statement description.
- `uploaded_at`: import/upload timestamp.
- `unexplained_amount`: amount not yet explained in FreeAgent.
- `is_manual`: manual vs statement/feed transaction.
- `transaction_id`: institution/shared transaction identifier where available.
- `created_at` and `updated_at`: sync metadata.
- `bank_transaction_explanations`: explanation entries when present.

Process for fetching transactions for a desired bank account:

1. Ensure the selected bank account has a FreeAgent `url`.
2. URL-encode the bank account URL when passing it as `bank_account`.
3. For an initial preview, call `GET /v2/bank_transactions?bank_account=:bank_account&from_date=:from&to_date=:to`.
4. For incremental sync, call `GET /v2/bank_transactions?bank_account=:bank_account&updated_since=:timestamp`.
5. Normalize each transaction using FreeAgent `url` or `transaction_id` for deduplication.
6. Preserve FreeAgent `description`, `full_description`, `unexplained_amount`, and explanation data
   for auditability.
7. Preview totals and row counts before local commit.

## 3. Implemented Slice

- Backend route namespace: `/api/integrations/freeagent`.
- UI route: `#/freeagent`.
- Secrets: `client_secret`, access token, and refresh token are encrypted with `PFS_SECRET_KEY`, or
  with an ignored local key file at `data/.pfs_secret.key` for local development.
- Supported environments: production, sandbox, and custom/mock base URL.
- Validation: calls `GET /v2/company` and `GET /v2/bank_accounts`, then stores validation status.
- Import: user selects bank account and either date range or incremental cursor mode.
- Persistence: FreeAgent accounts are stored as provider `FreeAgent`; transactions use
  FreeAgent URL/transaction ID fingerprints for idempotency; each run creates an `import_logs` row.
- Tests: mocked FreeAgent client covers validation, encrypted persistence, import, dedupe, cursor,
  and route behavior.

## 4. Goals

- Add a planning-ready, read-only FreeAgent integration design.
- Support sandbox-first development.
- Fetch Business bank accounts and balances.
- Fetch bank transactions for a selected FreeAgent bank account.
- Preserve entity scoping so Business data does not affect Household Snoop reports.
- Treat OAuth credentials and tokens as secrets.
- Preview fetched data before local persistence.

## 5. Non-Goals

- No FreeAgent write operations.
- No statement upload, transaction deletion, explanation creation, or reconciliation mutation.
- No production credentials committed to source control.
- No assistant access to raw tokens or Authorization headers.
- Full browser OAuth callback is deferred; this phase accepts manually obtained OAuth tokens.
- Pre-commit transaction preview is deferred; the flow asks account/date/incremental questions before
  local import.

## 6. Prerequisites

- FreeAgent sandbox account for development.
- Completed sandbox company setup; FreeAgent Quick Start notes setup should be completed to avoid
  unexpected API errors.
- FreeAgent Developer Dashboard app with OAuth identifier/client ID, OAuth secret, and redirect URI.
- Local environment variables or secure local secret store for:
  - `FREEAGENT_ENV=sandbox|production`
  - `FREEAGENT_CLIENT_ID`
  - `FREEAGENT_CLIENT_SECRET`
  - `FREEAGENT_REDIRECT_URI`
- Token storage design that avoids logging or committing access/refresh tokens.
- Business entity scoping plan or explicit temporary sandbox-only storage boundary.

## 7. Proposed Design

### Phase 0: Manual Postman Proof

Before implementation, use the checked-in Postman setup to prove the read-only FreeAgent flow:

- [Postman README](file:///postman/README.md)
- [Read-only collection](file:///postman/freeagent-readonly.postman_collection.json)
- [Environment template](file:///postman/freeagent-template.postman_environment.json)

The committed environment file must stay secret-free. Duplicate it locally in Postman before adding
client ID, client secret, OAuth token, refresh token, or selected bank account values.

### Phase A: Read-Only Adapter

Create a future FreeAgent adapter with responsibilities:

- Build sandbox/production base URL.
- Generate authorization URL.
- Exchange authorization code for access/refresh tokens.
- Refresh access token after expiry or 401.
- `list_bank_accounts(view?: string)`.
- `get_bank_account(account_url_or_id: string)`.
- `list_bank_transactions(bank_account_url: string, filters)`.

### Phase B: Normalization Layer

Normalize FreeAgent payloads into app-owned preview DTOs:

- `FreeAgentBankAccountPreview`
  - external URL, display name, type, currency, bank name, status, personal flag, current balance,
    latest activity date, updated timestamp.
- `FreeAgentBankTransactionPreview`
  - external URL, transaction ID, account external URL, date, amount, description, full description,
    unexplained amount, manual/imported flag, uploaded/created/updated timestamps, explanations.

### Phase C: Preview And Commit Boundary

Initial implementation should use a preview-first flow:

1. Connect FreeAgent.
2. List accounts.
3. Select account.
4. Fetch balance and date-window transactions.
5. Show preview: row count, date range, account currency, current balance, duplicate count, and
   warnings.
6. Commit later only after explicit approval and entity scoping are ready.

### Phase D: UI Flow

Planned UI flow:

1. Settings or Import Center: choose `Connect FreeAgent`.
2. Choose environment: sandbox first; production disabled until explicitly enabled.
3. Complete OAuth.
4. Display active FreeAgent bank accounts.
5. Select desired bank account.
6. Choose date range or incremental sync mode.
7. Fetch preview.
8. Commit/import only after review.

## 8. Test Plan

### Adapter Unit Tests

- Builds sandbox and production base URLs correctly.
- Generates authorization URL with client ID, redirect URI, response type, and state.
- Exchanges authorization code using token endpoint and stores expiry metadata.
- Refreshes token using refresh token flow.
- Adds `Authorization: Bearer TOKEN` to requests without logging token values.
- Lists bank accounts and parses `current_balance`, `currency`, `status`, and `latest_activity_date`.
- Gets a single bank account and handles missing/hidden accounts.
- Lists bank transactions for a selected bank account URL.
- Sends `from_date`, `to_date`, `updated_since`, `view`, and `last_uploaded` query params correctly.
- URL-encodes the FreeAgent bank account URL in query params.
- Handles 401, 403, 404, 406, 429, and 5xx responses without data loss.

### Service Tests

- Maps FreeAgent accounts to Business-scoped local preview records.
- Maps FreeAgent transactions to local preview rows with signed amounts preserved.
- Uses FreeAgent transaction URL or `transaction_id` for deduplication.
- Preserves raw description/full description for auditability.
- Does not create Household records from FreeAgent Business fetches.
- Produces preview counts: received, duplicate, invalid, warnings.
- Handles currency mismatch warnings.
- Handles missing `transaction_id` by falling back to URL/date/amount/description fingerprint.

### API Tests

- Planned `GET /api/integrations/freeagent/accounts/preview` returns normalized accounts.
- Planned `GET /api/integrations/freeagent/transactions/preview` requires selected account and date
  filters.
- Planned callback/token endpoints reject invalid state.
- Planned token refresh path returns a safe error if refresh token is missing or expired.
- No endpoint returns token, client secret, or Authorization header values.

### Frontend Tests

- FreeAgent connect screen explains sandbox vs production.
- Account selector shows account name, type, currency, current balance, and latest activity date.
- Transaction preview shows selected account, date range, row count, totals, duplicates, and warnings.
- User cannot commit fetched data without explicit review.
- Error states cover unauthorized, permission denied, invalid account, and service unavailable.

### Manual Sandbox Test

- Create sandbox account and complete setup.
- Register app in FreeAgent Developer Dashboard.
- Authorize app.
- Fetch `/v2/bank_accounts`.
- Select a bank account and verify `current_balance`.
- Fetch `/v2/bank_transactions?bank_account=:bank_account&from_date=:from&to_date=:to`.
- Verify transaction count and amounts against FreeAgent UI.

## 8. Risks And Open Questions

- **Pagination/rate limits:** confirm current FreeAgent pagination and rate-limit behavior before
  implementation; design adapter so pagination can be added without changing service contracts.
- **Token storage:** choose local encrypted storage, database encryption, or environment-driven
  development-only storage before production mode.
- **Business scoping:** if Business backend scoping is not ready, keep this integration in sandbox
  preview mode only.
- **Balance freshness:** `current_balance` reflects FreeAgent's latest known balance, not necessarily
  real-time bank balance.
- **Accounting semantics:** FreeAgent transaction explanations are accounting-specific and should be
  preserved but not automatically mapped to Household categories.
