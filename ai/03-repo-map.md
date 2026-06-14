<!---
ai-eos-metadata:
  purpose: "Repository layout and navigation guide."
  how_to_use: "Consult to find project context and future implementation areas."
  generated_by: "Manual Genesis-aligned bootstrap"
--->

# Repo Map - Personal Finance Studio

Current repository status: planning-only skeleton.

## Current Structure

- `README.md`: project overview and locked direction.
- `AGENTS.md`: AI agent operating rules.
- `.ai-eos.yaml`: Genesis-compatible manifest.
- `ai/`: planning and operating context.
- `ai/specs/`: product and technical specifications.
- `ai/tasks/`: implementation task definitions.
- `ai/roadmap/`: phased roadmap.
- `ai/runs/`: future agent run logs.

## Future Implementation Structure

Expected once implementation begins:

- `app/`: FastAPI backend package.
- `app/models/`: SQLAlchemy models.
- `app/schemas/`: Pydantic schemas.
- `app/routes/`: API routes.
- `app/services/`: import, classification, transfer, forecast, and decision services.
- `alembic/`: database migrations.
- `frontend/`: React + Vite app.
- `frontend/src/`: routes, components, data clients, design tokens.
- `tests/`: backend tests.
- `docker-compose.yml`: local PostgreSQL runtime.
