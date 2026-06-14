from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_session
from app.schemas.planning import PlanningOverview
from app.services.internal_transfers import get_household_entity_id
from app.services.planning import get_planning_overview

router = APIRouter()


@router.get("/overview", response_model=PlanningOverview)
def planning_overview(
    session: Annotated[Session, Depends(get_session)],
) -> PlanningOverview:
    try:
        entity_id = get_household_entity_id(session)
        return get_planning_overview(session, entity_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
