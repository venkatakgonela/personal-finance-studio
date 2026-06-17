from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.plaid import (
    PlaidExchangeRequest,
    PlaidImportRequest,
    PlaidImportResult,
    PlaidLinkToken,
    PlaidPreview,
    PlaidStatus,
)
from app.services.plaid_integration import (
    PlaidIntegrationError,
    create_link_token,
    exchange_public_token,
    get_status,
    import_plaid,
    preview_plaid,
)

router = APIRouter()


@router.get("/status", response_model=PlaidStatus)
def plaid_status(session: Annotated[Session, Depends(get_session)]) -> PlaidStatus:
    return get_status(session)


@router.post("/link-token", response_model=PlaidLinkToken)
def plaid_link_token(session: Annotated[Session, Depends(get_session)]) -> PlaidLinkToken:
    try:
        return create_link_token(session)
    except PlaidIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/exchange", response_model=PlaidStatus)
def plaid_exchange_public_token(
    payload: PlaidExchangeRequest,
    session: Annotated[Session, Depends(get_session)],
) -> PlaidStatus:
    try:
        return exchange_public_token(payload, session)
    except PlaidIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/preview", response_model=PlaidPreview)
def plaid_preview(
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(ge=1, le=730)] = 30,
) -> PlaidPreview:
    try:
        return preview_plaid(session, days=days)
    except PlaidIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import", response_model=PlaidImportResult)
def plaid_import(
    payload: PlaidImportRequest,
    session: Annotated[Session, Depends(get_session)],
) -> PlaidImportResult:
    try:
        return import_plaid(payload, session)
    except PlaidIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
