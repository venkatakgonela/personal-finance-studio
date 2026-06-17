import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import (
    accounts,
    calendar,
    commitments,
    dashboard,
    decisions,
    forecast,
    freeagent,
    imports,
    insights,
    planning,
    transactions,
    transfers,
)
from app.services.freeagent_scheduler import run_freeagent_auto_sync_worker


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    task: asyncio.Task | None = None
    if settings.freeagent_auto_sync_worker_enabled:
        task = asyncio.create_task(run_freeagent_auto_sync_worker(settings))
        app.state.freeagent_auto_sync_task = task
    try:
        yield
    finally:
        if task is not None:
            task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

    app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
    app.include_router(freeagent.router, prefix="/api/integrations/freeagent", tags=["freeagent"])
    app.include_router(transfers.router, prefix="/api/transfers", tags=["transfers"])
    app.include_router(commitments.router, prefix="/api/commitments", tags=["commitments"])
    app.include_router(decisions.router, prefix="/api/decisions", tags=["decisions"])
    app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
    app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
    app.include_router(forecast.router, prefix="/api/forecast", tags=["forecast"])
    app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
    app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
    app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
    app.include_router(planning.router, prefix="/api/planning", tags=["planning"])
    return app


app = create_app()
