from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.commitments import (
    BillInstancePayment,
    BillInstanceSummary,
    CommitmentCreate,
    CommitmentDetectionResult,
    CommitmentsResponse,
    CommitmentSummary,
    CommitmentUpdate,
)
from app.services.commitments import (
    create_manual_commitment,
    delete_commitment,
    detect_recurring_commitments,
    list_commitments,
    mark_bill_instance_paid,
    update_commitment,
)
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.post("/detect", response_model=CommitmentDetectionResult)
def detect_commitments(
    session: Annotated[Session, Depends(get_session)],
) -> CommitmentDetectionResult:
    try:
        entity_id = get_household_entity_id(session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return detect_recurring_commitments(session, entity_id)


@router.get("", response_model=CommitmentsResponse)
def commitments(
    session: Annotated[Session, Depends(get_session)],
    limit: int = 50,
) -> CommitmentsResponse:
    try:
        entity_id = get_household_entity_id(session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return list_commitments(session, entity_id, limit=limit)


@router.post("", response_model=CommitmentSummary)
def create_commitment(
    payload: CommitmentCreate,
    session: Annotated[Session, Depends(get_session)],
) -> CommitmentSummary:
    try:
        entity_id = get_household_entity_id(session)
        return create_manual_commitment(session, entity_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{commitment_id}", response_model=CommitmentSummary)
def patch_commitment(
    commitment_id: str,
    payload: CommitmentUpdate,
    session: Annotated[Session, Depends(get_session)],
) -> CommitmentSummary:
    try:
        entity_id = get_household_entity_id(session)
        return update_commitment(session, entity_id, commitment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{commitment_id}", response_model=CommitmentSummary)
def remove_commitment(
    commitment_id: str,
    session: Annotated[Session, Depends(get_session)],
) -> CommitmentSummary:
    try:
        entity_id = get_household_entity_id(session)
        return delete_commitment(session, entity_id, commitment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/instances/{instance_id}/mark-paid", response_model=BillInstanceSummary)
def mark_instance_paid(
    instance_id: str,
    payload: BillInstancePayment,
    session: Annotated[Session, Depends(get_session)],
) -> BillInstanceSummary:
    try:
        entity_id = get_household_entity_id(session)
        return mark_bill_instance_paid(session, entity_id, instance_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
