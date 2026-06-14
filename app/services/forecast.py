from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillInstance, Commitment, Entity
from app.schemas.forecast import ForecastPoint, ForecastResponse
from app.services.dashboard import get_dashboard_summary, latest_transaction_date


def get_cashflow_forecast(
    session: Session,
    entity_id: str,
    *,
    start_date: date | None = None,
    days: int = 30,
    include_candidates: bool = True,
) -> ForecastResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    start_date = start_date or latest_transaction_date(session, entity_id) or date.today()
    end_date = start_date + timedelta(days=days)
    dashboard = get_dashboard_summary(session, entity_id, today=start_date)
    starting_balance = Decimal(dashboard.cash_on_hand) if dashboard.cash_on_hand else None
    running_balance = starting_balance
    lowest_balance = starting_balance

    allowed_statuses = ["confirmed", "candidate"] if include_candidates else ["confirmed"]
    rows = session.execute(
        select(BillInstance, Commitment)
        .join(Commitment, Commitment.id == BillInstance.commitment_id)
        .where(
            BillInstance.entity_id == entity_id,
            BillInstance.due_date >= start_date,
            BillInstance.due_date <= end_date,
            BillInstance.status.in_(["planned", "due_soon", "needs_review"]),
            Commitment.status.in_(allowed_statuses),
        )
        .order_by(BillInstance.due_date.asc(), Commitment.name.asc())
    ).all()

    points: list[ForecastPoint] = []
    confirmed_total = Decimal("0.00")
    candidate_total = Decimal("0.00")
    for instance, commitment in rows:
        amount = instance.expected_amount
        if commitment.status == "confirmed":
            confirmed_total += amount
        else:
            candidate_total += amount

        if running_balance is not None and commitment.status == "confirmed":
            running_balance -= amount
            lowest_balance = min(lowest_balance or running_balance, running_balance)

        points.append(
            ForecastPoint(
                date=instance.due_date.isoformat(),
                label=commitment.name,
                kind=commitment.commitment_type,
                amount=format_money(amount),
                projected_balance=format_optional_money(running_balance),
                confidence=commitment.status,
            )
        )

    return ForecastResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        starting_balance=format_optional_money(starting_balance),
        projected_ending_balance=format_optional_money(running_balance),
        lowest_projected_balance=format_optional_money(lowest_balance),
        confirmed_commitments_total=format_money(confirmed_total),
        candidate_commitments_total=format_money(candidate_total),
        confidence="ready" if starting_balance is not None else "needs_balance_review",
        points=points,
    )


def format_optional_money(value: Decimal | None) -> str | None:
    return format_money(value) if value is not None else None


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
