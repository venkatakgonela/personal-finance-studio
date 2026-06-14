from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.accounts import AccountsSummaryResponse, AccountSummary, AccountUpdate
from app.services.accounts import get_accounts_summary, update_account
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("", response_model=AccountsSummaryResponse)
def accounts_summary(
    session: Annotated[Session, Depends(get_session)],
) -> AccountsSummaryResponse:
    try:
        entity_id = get_household_entity_id(session)
        return get_accounts_summary(session, entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{account_id}", response_model=AccountSummary)
def patch_account(
    account_id: str,
    payload: AccountUpdate,
    session: Annotated[Session, Depends(get_session)],
) -> AccountSummary:
    try:
        entity_id = get_household_entity_id(session)
        return update_account(session, entity_id, account_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
