from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Account,
    BillInstance,
    Commitment,
    ImportLog,
    InternalTransferMatch,
    Profile,
    Transaction,
)
from app.schemas.data import ResetDataResult
from app.services.import_commit import (
    DEFAULT_PROFILE_NAME,
    get_or_create_default_profile,
    get_or_create_household_entity,
)

RESET_MODELS = [BillInstance, InternalTransferMatch, Commitment, Transaction, Account, ImportLog]


def reset_household_data(session: Session) -> ResetDataResult:
    deleted: dict[str, int] = {}
    for model in RESET_MODELS:
        deleted[model.__tablename__] = int(
            session.scalar(select(func.count()).select_from(model)) or 0
        )
        session.execute(delete(model))

    entity = get_or_create_household_entity(session)
    profiles = session.scalars(select(Profile).where(Profile.entity_id == entity.id)).all()
    primary = next((profile for profile in profiles if profile.name == DEFAULT_PROFILE_NAME), None)
    if primary is None and profiles:
        primary = profiles[0]
        primary.name = DEFAULT_PROFILE_NAME
        primary.role = "owner"
    elif primary is None:
        primary = get_or_create_default_profile(session, entity)

    for profile in profiles:
        if profile.id != primary.id:
            session.delete(profile)

    session.commit()
    return ResetDataResult(
        deleted=deleted,
        entity_name=entity.name,
        profile_name=primary.name,
        status="reset",
    )
