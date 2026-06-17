from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.freeagent import (
    FreeAgentAccountManagementRequest,
    FreeAgentBankAccount,
    FreeAgentConnectionStatus,
    FreeAgentCredentials,
    FreeAgentImportRequest,
    FreeAgentImportResult,
    FreeAgentOAuthExchangeRequest,
    FreeAgentSyncAllRequest,
    FreeAgentSyncAllResult,
    FreeAgentValidationResult,
)
from app.services.freeagent_client import FreeAgentApiClient
from app.services.freeagent_import import (
    FreeAgentClientFactory,
    FreeAgentIntegrationError,
    exchange_authorization_code,
    get_status,
    import_bank_transactions,
    list_bank_accounts,
    manage_bank_account,
    save_credentials,
    sync_all_managed_accounts,
    validate_connection,
)

router = APIRouter()


def get_freeagent_client_factory() -> FreeAgentClientFactory:
    return FreeAgentApiClient


@router.get("/status", response_model=FreeAgentConnectionStatus)
def freeagent_status(
    session: Annotated[Session, Depends(get_session)],
) -> FreeAgentConnectionStatus:
    return get_status(session)


@router.post("/credentials", response_model=FreeAgentConnectionStatus)
def configure_freeagent(
    payload: FreeAgentCredentials,
    session: Annotated[Session, Depends(get_session)],
) -> FreeAgentConnectionStatus:
    try:
        return save_credentials(payload, session)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/oauth/exchange", response_model=FreeAgentConnectionStatus)
def exchange_freeagent_oauth_code(
    payload: FreeAgentOAuthExchangeRequest,
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> FreeAgentConnectionStatus:
    try:
        return exchange_authorization_code(
            payload,
            session,
            client_factory=client_factory,
        )
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/validate", response_model=FreeAgentValidationResult)
def validate_freeagent(
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> FreeAgentValidationResult:
    try:
        return validate_connection(session, client_factory=client_factory)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/bank-accounts", response_model=list[FreeAgentBankAccount])
def freeagent_bank_accounts(
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> list[FreeAgentBankAccount]:
    try:
        return list_bank_accounts(session, client_factory=client_factory)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/bank-accounts/manage", response_model=FreeAgentBankAccount)
def manage_freeagent_bank_account(
    payload: FreeAgentAccountManagementRequest,
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> FreeAgentBankAccount:
    try:
        return manage_bank_account(payload, session, client_factory=client_factory)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import", response_model=FreeAgentImportResult)
def import_freeagent_transactions(
    payload: FreeAgentImportRequest,
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> FreeAgentImportResult:
    try:
        return import_bank_transactions(payload, session, client_factory=client_factory)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sync-all", response_model=FreeAgentSyncAllResult)
def sync_freeagent_accounts(
    payload: FreeAgentSyncAllRequest,
    session: Annotated[Session, Depends(get_session)],
    client_factory: Annotated[Callable, Depends(get_freeagent_client_factory)],
) -> FreeAgentSyncAllResult:
    try:
        return sync_all_managed_accounts(payload, session, client_factory=client_factory)
    except FreeAgentIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
