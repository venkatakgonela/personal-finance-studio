from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.forecast import ForecastResponse
from app.services.forecast import get_cashflow_forecast
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("", response_model=ForecastResponse)
def forecast(
    session: Annotated[Session, Depends(get_session)],
    start_date: date | None = None,
    days: Annotated[int, Query(ge=1, le=120)] = 30,
    include_candidates: bool = True,
) -> ForecastResponse:
    try:
        entity_id = get_household_entity_id(session)
        return get_cashflow_forecast(
            session,
            entity_id,
            start_date=start_date,
            days=days,
            include_candidates=include_candidates,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
