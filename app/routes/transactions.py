from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.transactions import (
    TransactionLedgerResponse,
    TransactionSummary,
    TransactionUpdate,
)
from app.services.internal_transfers import get_household_entity_id
from app.services.transactions import get_transaction_ledger, update_transaction

router = APIRouter()


@router.get("", response_model=TransactionLedgerResponse)
def transaction_ledger(
    session: Annotated[Session, Depends(get_session)],
    account_id: Annotated[str | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    include_transfer_candidates: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    normalized_group: Annotated[str | None, Query()] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    reviewed: Annotated[bool | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    transaction_type: Annotated[str | None, Query()] = None,
) -> TransactionLedgerResponse:
    try:
        entity_id = get_household_entity_id(session)
        return get_transaction_ledger(
            session,
            entity_id,
            account_id=account_id,
            end_date=end_date,
            include_transfer_candidates=include_transfer_candidates,
            limit=limit,
            normalized_group=normalized_group,
            offset=offset,
            reviewed=reviewed,
            search=search,
            start_date=start_date,
            status=status,
            transaction_type=transaction_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{transaction_id}", response_model=TransactionSummary)
def patch_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    session: Annotated[Session, Depends(get_session)],
) -> TransactionSummary:
    try:
        entity_id = get_household_entity_id(session)
        return update_transaction(session, entity_id, transaction_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
