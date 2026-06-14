<!---
ai-eos-metadata:
  purpose: "Operational visibility, logs, metrics, and diagnostics."
  how_to_use: "Consult when adding import logs, sync status, or runtime diagnostics."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Observability - Personal Finance Studio

## Phase 1 Observability

- Import logs per entity and source file.
- Row counts: received, imported, skipped, duplicate, invalid.
- Parser warnings for missing columns or unexpected values.
- Account balance freshness.
- Decision Queue counts by decision type.
- Internal transfer match confidence and unresolved candidates.
- Forecast generated timestamp and assumptions.

## Future Observability

- Open Banking sync status.
- Stale connection warnings.
- LLM assistant audit trail for read-only queries.
- Background worker job logs.
