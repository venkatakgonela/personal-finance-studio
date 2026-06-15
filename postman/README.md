# FreeAgent Postman Setup

This folder contains a safe, read-only Postman setup for manually proving the FreeAgent API flow
before implementation.

## Files

- `freeagent-readonly.postman_collection.json`: read-only requests for company, bank accounts, and
  bank transactions.
- `freeagent-template.postman_environment.json`: environment variables with blank secrets. This file
  is safe to commit.

## Safety Rules

- Do not commit an environment export after filling in secrets.
- Do not sync the filled environment to Postman cloud if using production credentials.
- Use a temporary FreeAgent OAuth secret for testing, then revoke or rotate it after validation.
- Keep this collection read-only: do not add statement upload, delete, explain, or mutate requests.

## Setup

1. Import both JSON files into Postman.
2. Duplicate the `FreeAgent - Template` environment and rename it to `FreeAgent - Local`.
3. In the duplicated local environment, set:
   - `base_url`: `https://api.freeagent.com` for production or `https://api.sandbox.freeagent.com` for sandbox.
   - `auth_url`: `https://api.freeagent.com/v2/approve_app` or sandbox equivalent.
   - `token_url`: `https://api.freeagent.com/v2/token_endpoint` or sandbox equivalent.
   - `client_id`: FreeAgent OAuth identifier.
   - `client_secret`: FreeAgent OAuth secret.
   - `redirect_uri`: `https://www.getpostman.com/oauth2/callback`.
4. Select the local environment in Postman.
5. Open the collection `Authorization` tab.
6. Click `Get New Access Token`.
7. Log in to FreeAgent and approve the app.
8. Click `Use Token`.

## Test Flow

1. Run `01 - Get Company`.
2. Run `02 - List Bank Accounts`.
3. Copy the desired `bank_account.url` value into the environment variable `bank_account_url`.
4. Optionally set `from_date`, `to_date`, `updated_since`, `view`, or `last_uploaded`.
5. Run `04 - List Bank Transactions For Selected Account`.

Postman query params should handle URL encoding for `bank_account_url` when it is sent as a query
parameter. If a request fails, confirm the account URL is copied exactly from the bank accounts
response and the token belongs to the same FreeAgent company.

## Expected Data

`GET /v2/bank_accounts` should return account records that include fields such as `url`, `name`,
`type`, `currency`, `status`, `current_balance`, and `latest_activity_date`.

`GET /v2/bank_transactions?bank_account=:bank_account` should return transactions for the selected
account, including fields such as `url`, `amount`, `bank_account`, `dated_on`, `description`,
`full_description`, `uploaded_at`, `unexplained_amount`, `is_manual`, `transaction_id`, and
timestamps.
