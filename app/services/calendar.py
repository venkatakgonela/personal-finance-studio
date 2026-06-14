from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillInstance, Commitment, Entity
from app.schemas.calendar import UpcomingCommitmentInstance, UpcomingCommitmentsResponse
from app.services.dashboard import latest_transaction_date


def list_upcoming_commitments(
    session: Session,
    entity_id: str,
    *,
    start_date: date | None = None,
    days: int = 30,
    include_candidates: bool = True,
) -> UpcomingCommitmentsResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    start_date = start_date or latest_transaction_date(session, entity_id) or date.today()
    end_date = start_date + timedelta(days=days)
    allowed_commitment_statuses = ["confirmed"]
    if include_candidates:
        allowed_commitment_statuses.append("candidate")

    rows = session.execute(
        select(BillInstance, Commitment)
        .join(Commitment, Commitment.id == BillInstance.commitment_id)
        .where(
            BillInstance.entity_id == entity_id,
            BillInstance.due_date >= start_date,
            BillInstance.due_date <= end_date,
            BillInstance.status.in_(["planned", "due_soon", "needs_review"]),
            Commitment.status.in_(allowed_commitment_statuses),
        )
        .order_by(BillInstance.due_date.asc(), Commitment.name.asc())
    ).all()

    items = [serialize_instance(instance, commitment) for instance, commitment in rows]
    total = sum((Decimal(item.expected_amount) for item in items), Decimal("0.00"))
    return UpcomingCommitmentsResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        total_count=len(items),
        expected_total=format_money(total),
        items=items,
    )


def serialize_instance(
    instance: BillInstance,
    commitment: Commitment,
) -> UpcomingCommitmentInstance:
    return UpcomingCommitmentInstance(
        id=instance.id,
        commitment_id=commitment.id,
        commitment_name=commitment.name,
        commitment_status=commitment.status,
        commitment_type=commitment.commitment_type,
        due_date=instance.due_date.isoformat(),
        expected_amount=format_money(instance.expected_amount),
        estimated_amount=format_optional_money(instance.estimated_amount),
        actual_amount=format_optional_money(instance.actual_amount),
        status=instance.status,
    )


def format_optional_money(value: Decimal | None) -> str | None:
    return format_money(value) if value is not None else None


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
