<!---
ai-eos-metadata:
  purpose: "Operational visibility, logs, metrics, and diagnostics."
  how_to_use: "Consult when adding import logs, sync status, or runtime diagnostics."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Observability - Personal Finance Studio

**Last reviewed:** 2026-06-14

## Phase 1 Observability

- [x] Import logs per entity and source file.
- [x] Row counts: received, imported, skipped, duplicate, invalid.
- [x] Parser warnings for missing columns or unexpected values.
- [x] Account balance readiness via dashboard missing-balance counts.
- [x] Decision Queue total counts and UI summary counts by decision type.
- [x] Internal transfer match confidence and unresolved candidates.
- [x] Forecast assumptions through selected start date, days, candidate inclusion, and confidence fields.
- [x] E2E health signal for API availability to catch `Failed to fetch`.

## Still Needed

- Import freshness indicator in the UI.
- Forecast generated timestamp.
- Stale recurring commitment diagnostics.
- Structured application logs beyond Uvicorn/dev-server output.

## Future Observability

- Open Banking sync status.
- Stale connection warnings.
- LLM assistant audit trail for read-only queries.
- Background worker job logs.
