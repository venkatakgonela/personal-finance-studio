# Personal Finance Studio

Personal Finance Studio is a local-first Household and Business Finance Control Center.

The first release focuses on the Household entity using Snoop CSV imports. It helps answer:

- What money exists right now?
- What is already committed?
- What is flexible and safe to spend?
- What bills, credit cards, loans, and BNPL payments are due next?
- What will balances look like on a selected future date?

Implementation has moved through the locked Phase 1 plan and Phase 1.5 planning-depth slice. The
current local app supports Snoop import, account and transaction review, internal transfer
candidates, recurring commitment candidates, date-windowed bills, Phase 1.5 planning routes, saved
filter drilldowns, import freshness, local service health, Monarch-inspired reporting visuals,
FreeAgent read-only account import, and a dashboard with time-aware greeting, balance-readiness
status, spending pulse, and compact Decision Queue preview.

All current Household money views are GBP-only.

## Planning Docs

- [Project Charter](ai/00-project-charter.md)
- [Architecture](ai/01-architecture.md)
- [Domain Model](ai/02-domain-model.md)
- [Decisions / ADRs](ai/04-decisions.md)
- [Roadmap](ai/roadmap/ROADMAP.md)
- [Phase 1 Specification](ai/specs/SPEC-001-phase-1-household-snoop.md)
- [Screen & Design Specification](ai/specs/SPEC-002-screen-and-design-system.md)
- [Testing Strategy](ai/specs/SPEC-003-testing-strategy.md)

## Locked Direction

- Frontend: React + Vite + TypeScript
- Backend: FastAPI + Python
- Database: PostgreSQL
- Phase 1 integration: Snoop CSV import
- Phase 1 entity: Household
- Current live integration: FreeAgent read-only import for accounting/business reference.
- Next personal banking direction: direct Monzo API plus an Open Banking aggregator connector.
- Future entities/integrations: Business, Tide CSV, NatWest Business CSV, local LLM assistant.

## Banking Integration Direction

FreeAgent is useful for read-only accounting/business imports, but it is not the preferred source of
truth for personal banking because balances can depend on bookkeeping reconciliation and may lag
online-bank balances. Personal account balances and transactions should come from bank/Open Banking
sources instead.

Recommended connector path:

- **Snoop CSV for broad coverage**: use Snoop exports for multi-bank snapshots and historical
  transactions when direct feeds are not available.
- **Monzo Google Sheets for pot-level truth**: use the Monzo auto-export sheet for current account,
  pot, and transaction evidence because bills may depend on a specific pot rather than household
  cash overall.
- **Open Banking aggregator later**: evaluate GoCardless Bank Account Data first, then TrueLayer,
  Yapily, Tink, Moneyhub, Salt Edge, or Plaid only if UK personal access, consent refresh, and
  pricing make sense.
- **Provider abstraction**: normalize all external connectors into the app's account, balance,
  transaction, consent, cursor, and sync-health model.
- **Regulatory boundary**: keep this local/personal until a regulated provider or FCA-authorised
  Account Information Service Provider route is deliberately selected for any multi-user product.

## Local Development

Full local stack:

```bash
./scripts/dev-local.sh
```

This starts Docker/Postgres, applies migrations, starts the FastAPI backend on `8025`, and starts
the Vite frontend on `5175`. The app also shows API health in the top bar and under
`#/settings`.

Backend only:

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8025
```

Optional local settings:

- `PFS_SECRET_KEY` or `PFS_SECRET_KEY_FILE`: encrypts local OAuth client secrets and tokens.
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`: one-time Google OAuth app
  settings for the Monzo Google Sheets connector. The user still signs in with their personal
  Google account; these values are app configuration, not day-to-day user credentials.
- `FREEAGENT_AUTO_SYNC_WORKER_ENABLED=true|false`: enables the local FreeAgent auto-sync worker.
- `FREEAGENT_AUTO_SYNC_CHECK_SECONDS=300`: how often the worker checks for FreeAgent accounts due
  for the once-daily post-06:00 sync.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Database:

```bash
docker compose up -d
```

Default local ports:

- Backend API: `8025`
- Frontend: `5175`
- PostgreSQL: `5435`

## Quality Gates

Backend:

```bash
uv run ruff check .
uv run pytest
env DATABASE_URL=sqlite+pysqlite:////private/tmp/pfs_alembic_smoke.db uv run alembic upgrade head
```

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
npm run test:e2e
```
