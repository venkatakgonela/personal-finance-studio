from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.insights import InsightsResponse
from app.services.insights import get_insights
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("", response_model=InsightsResponse)
def insights(
    session: Annotated[Session, Depends(get_session)],
    start_date: date | None = None,
    end_date: date | None = None,
) -> InsightsResponse:
    try:
        entity_id = get_household_entity_id(session)
        return get_insights(session, entity_id, start_date=start_date, end_date=end_date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
