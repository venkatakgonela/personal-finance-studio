from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard import get_dashboard_summary
from app.services.internal_transfers import get_household_entity_id

router = APIRouter()


@router.get("", response_model=DashboardSummary)
def dashboard_summary(
    session: Annotated[Session, Depends(get_session)],
) -> DashboardSummary:
    try:
        entity_id = get_household_entity_id(session)
        return get_dashboard_summary(session, entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
