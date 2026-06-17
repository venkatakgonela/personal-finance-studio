from __future__ import annotations

import asyncio
import contextlib

from sqlalchemy import select

from app.config import Settings
from app.db import SessionLocal
from app.models import IntegrationAccount, IntegrationConnection
from app.schemas.freeagent import FreeAgentSyncAllRequest
from app.services.freeagent_import import PROVIDER, is_sync_due, sync_all_managed_accounts


async def run_freeagent_auto_sync_worker(settings: Settings) -> None:
    """Poll due managed FreeAgent accounts; accounts sync once daily after 06:00."""
    while True:
        await asyncio.sleep(settings.freeagent_auto_sync_check_seconds)
        if not settings.freeagent_auto_sync_worker_enabled:
            continue
        await asyncio.to_thread(sync_due_freeagent_accounts_once)


def sync_due_freeagent_accounts_once() -> None:
    with SessionLocal() as session:
        connection = session.scalar(
            select(IntegrationConnection).where(
                IntegrationConnection.provider == PROVIDER,
                IntegrationConnection.status == "validated",
            )
        )
        if connection is None:
            return
        enabled_accounts = session.scalars(
            select(IntegrationAccount).where(
                IntegrationAccount.connection_id == connection.id,
                IntegrationAccount.is_managed.is_(True),
                IntegrationAccount.auto_sync_enabled.is_(True),
            )
        ).all()
        if not any(is_sync_due(account) for account in enabled_accounts):
            return
        with contextlib.suppress(Exception):
            sync_all_managed_accounts(
                FreeAgentSyncAllRequest(force=False, only_auto_sync_enabled=True),
                session,
            )
