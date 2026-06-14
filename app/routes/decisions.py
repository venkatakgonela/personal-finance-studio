from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.decisions import DecisionActionResult, DecisionQueueResponse
from app.services.decisions import confirm_decision, list_decisions, reject_decision
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("", response_model=DecisionQueueResponse)
def decision_queue(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 25,
) -> DecisionQueueResponse:
    try:
        entity_id = get_household_entity_id(session)
        return list_decisions(session, entity_id, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{decision_type}/{decision_id}/confirm", response_model=DecisionActionResult)
def confirm_queue_decision(
    decision_type: str,
    decision_id: str,
    session: Annotated[Session, Depends(get_session)],
) -> DecisionActionResult:
    try:
        entity_id = get_household_entity_id(session)
        return confirm_decision(session, entity_id, decision_type, decision_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{decision_type}/{decision_id}/reject", response_model=DecisionActionResult)
def reject_queue_decision(
    decision_type: str,
    decision_id: str,
    session: Annotated[Session, Depends(get_session)],
) -> DecisionActionResult:
    try:
        entity_id = get_household_entity_id(session)
        return reject_decision(session, entity_id, decision_type, decision_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
