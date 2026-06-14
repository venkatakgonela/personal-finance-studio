from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Entity, Transaction
from app.schemas.insights import CategoryInsight, InsightsResponse, MerchantInsight
from app.services.categories import normalized_group_for_transaction
from app.services.dashboard import latest_transaction_date


def get_insights(
    session: Session,
    entity_id: str,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
) -> InsightsResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    end_date = end_date or latest_transaction_date(session, entity_id)
    if start_date is None and end_date is not None:
        start_date = end_date.replace(day=1)

    query = select(Transaction).where(
        Transaction.entity_id == entity_id,
        Transaction.transaction_type.not_in(
            ["internal_transfer", "internal_transfer_candidate", "ignored"]
        ),
    )
    if start_date is not None:
        query = query.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        query = query.where(Transaction.transaction_date <= end_date)

    transactions = session.scalars(query).all()
    grouped: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {
            "count": 0,
            "inflow": Decimal("0.00"),
            "outflow": Decimal("0.00"),
            "net": Decimal("0.00"),
        }
    )
    merchant_totals: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {"count": 0, "outflow": Decimal("0.00")}
    )

    for transaction in transactions:
        group = normalized_group_for_transaction(transaction)
        grouped[group]["count"] += 1
        grouped[group]["net"] += transaction.amount
        if transaction.amount > 0:
            grouped[group]["inflow"] += transaction.amount
        else:
            grouped[group]["outflow"] += abs(transaction.amount)
            merchant = transaction.merchant_name or transaction.description or "Unknown"
            merchant_totals[merchant]["count"] += 1
            merchant_totals[merchant]["outflow"] += abs(transaction.amount)

    category_groups = [
        CategoryInsight(
            group=group,
            transaction_count=int(values["count"]),
            inflow_total=format_money(values["inflow"]),
            outflow_total=format_money(values["outflow"]),
            net_total=format_money(values["net"]),
        )
        for group, values in sorted(grouped.items())
    ]
    top_merchants = [
        MerchantInsight(
            merchant_name=merchant,
            transaction_count=int(values["count"]),
            outflow_total=format_money(values["outflow"]),
        )
        for merchant, values in sorted(
            merchant_totals.items(),
            key=lambda item: item[1]["outflow"],
            reverse=True,
        )[:10]
    ]

    return InsightsResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        start_date=start_date.isoformat() if start_date else None,
        end_date=end_date.isoformat() if end_date else None,
        category_groups=category_groups,
        top_merchants=top_merchants,
        internal_transfers_excluded=True,
    )


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
