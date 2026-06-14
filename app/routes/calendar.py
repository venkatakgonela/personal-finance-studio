from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.calendar import UpcomingCommitmentsResponse
from app.services.calendar import list_upcoming_commitments
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("/upcoming", response_model=UpcomingCommitmentsResponse)
def upcoming_commitments(
    session: Annotated[Session, Depends(get_session)],
    start_date: date | None = None,
    days: int = 30,
    include_candidates: bool = True,
) -> UpcomingCommitmentsResponse:
    try:
        entity_id = get_household_entity_id(session)
        return list_upcoming_commitments(
            session,
            entity_id,
            start_date=start_date,
            days=days,
            include_candidates=include_candidates,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
