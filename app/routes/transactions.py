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
    include_transfer_candidates: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransactionLedgerResponse:
    try:
        entity_id = get_household_entity_id(session)
        return get_transaction_ledger(
            session,
            entity_id,
            include_transfer_candidates=include_transfer_candidates,
            limit=limit,
            offset=offset,
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
