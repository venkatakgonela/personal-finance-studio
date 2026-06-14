from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.transfers import InternalTransferCandidate, InternalTransferDetectionResult
from app.services.internal_transfers import (
    detect_internal_transfers,
    get_household_entity_id,
    list_internal_transfer_candidates,
)

router = APIRouter()


@router.post("/detect", response_model=InternalTransferDetectionResult)
def detect_transfers(
    session: Annotated[Session, Depends(get_session)],
) -> InternalTransferDetectionResult:
    try:
        entity_id = get_household_entity_id(session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return detect_internal_transfers(session, entity_id)


@router.get("/candidates", response_model=list[InternalTransferCandidate])
def transfer_candidates(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 50,
) -> list[InternalTransferCandidate]:
    try:
        entity_id = get_household_entity_id(session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return list_internal_transfer_candidates(session, entity_id, limit=limit)
