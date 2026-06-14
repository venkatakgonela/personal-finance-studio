# TASK-009: Recurring Commitment Candidates

## Objective

Detect likely recurring bills, subscriptions, loans, credit-card payments, and annual fees from
imported Snoop transactions without automatically treating them as confirmed obligations.

## Scope

- Add commitment and bill instance persistence.
- Add idempotent recurring candidate detection.
- Exclude matched transfer transactions.
- Keep detection conservative enough to avoid flexible-spend noise.
- Surface candidates through backend APIs and the current React import workflow.

## Acceptance Criteria

- [x] Recurring candidates are persisted as `candidate`, not `confirmed`.
- [x] Historical paid instances and one next planned instance are created.
- [x] Detection is idempotent.
- [x] Internal transfer matches are excluded from recurring detection.
- [x] Real Snoop data produces a focused candidate list rather than hundreds of noisy patterns.
- [x] Backend tests cover candidate creation, idempotency, list API, and API routes.
