<!---
ai-eos-metadata:
  purpose: "Feature record for Snoop import, accounts, transactions, and persistence."
  how_to_use: "Use when changing import, account, transaction, or deduplication behavior."
  generated_by: "Codex AI-EOS artifact alignment"
--->

# FEATURE-001: Snoop Import And Transaction Foundation

**Epic:** [EPIC-001: Household Control Center](file:///ai/epics/EPIC-001-household-control-center.md)  
**Status:** Complete locally  

## 1. Description & User Stories

- **Description:** Import Snoop CSV data into durable local records with preview, validation,
  fingerprinting, account detection, transaction persistence, and idempotency.
- **As a** household finance user **I want to** preview and commit CSV exports safely **so that** I
  can trust the app before it stores or reports on my money data.

## 2. Acceptance Criteria

- [x] Snoop CSV preview reports row counts, accounts, dates, categories, duplicates, and warnings.
- [x] Import commit persists accounts, transactions, and import logs without duplicate rows.
- [x] Imported raw files are parsed and discarded rather than retained.
- [x] Transactions remain auditable back to imported merchant/description values.
- [x] Transactions page acts as a review workbench with review coverage, possible bill/transfer
  signals, source bank label, app group interpretation, user review type, and deterministic
  "why this group?" explanations.

## 3. Source Tasks

- [x] [TASK-004: Bootstrap Implementation Foundation](file:///ai/tasks/TASK-004-bootstrap-implementation-foundation.md)
- [x] [TASK-005: Persist Snoop Imports](file:///ai/tasks/TASK-005-persist-snoop-imports.md)
- [x] [TASK-007: Account Transaction Read APIs](file:///ai/tasks/TASK-007-account-transaction-read-apis.md)
- [x] [TASK-008: Wire Import UI](file:///ai/tasks/TASK-008-wire-import-ui.md)

## 4. Verification

- `uv run pytest tests/test_snoop_import.py tests/test_import_commit.py tests/test_accounts_transactions.py`
- `uv run pytest tests/test_api.py`
