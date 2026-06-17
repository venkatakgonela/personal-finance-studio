from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.google_sheets import (
    GoogleSheetsConfig,
    GoogleSheetsImportResult,
    GoogleSheetsStatus,
)
from app.services.monzo_google_sheets import (
    DEFAULT_FRONTEND_REDIRECT,
    GoogleSheetsIntegrationError,
    exchange_authorization_code,
    get_status,
    import_transactions,
    save_config,
    validate_connection,
)

router = APIRouter()


@router.get("/status", response_model=GoogleSheetsStatus)
def monzo_google_sheets_status(
    session: Annotated[Session, Depends(get_session)],
) -> GoogleSheetsStatus:
    return get_status(session)


@router.post("/config", response_model=GoogleSheetsStatus)
def configure_monzo_google_sheets(
    payload: GoogleSheetsConfig,
    session: Annotated[Session, Depends(get_session)],
) -> GoogleSheetsStatus:
    try:
        return save_config(payload, session)
    except GoogleSheetsIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/oauth/callback")
def monzo_google_sheets_oauth_callback(
    session: Annotated[Session, Depends(get_session)],
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str = Query(default=""),
) -> RedirectResponse:
    if error:
        return RedirectResponse(f"{DEFAULT_FRONTEND_REDIRECT}?google=error&message={error}")
    try:
        exchange_authorization_code(code=code, state=state, session=session)
    except GoogleSheetsIntegrationError as exc:
        return RedirectResponse(f"{DEFAULT_FRONTEND_REDIRECT}?google=error&message={str(exc)}")
    return RedirectResponse(f"{DEFAULT_FRONTEND_REDIRECT}?google=connected")


@router.post("/validate", response_model=GoogleSheetsStatus)
def validate_monzo_google_sheets(
    session: Annotated[Session, Depends(get_session)],
) -> GoogleSheetsStatus:
    try:
        return validate_connection(session)
    except GoogleSheetsIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import", response_model=GoogleSheetsImportResult)
def import_monzo_google_sheets(
    session: Annotated[Session, Depends(get_session)],
) -> GoogleSheetsImportResult:
    try:
        return import_transactions(session)
    except GoogleSheetsIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
