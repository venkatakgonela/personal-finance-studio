from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Account, Entity, InternalTransferMatch, Transaction
from app.schemas.transactions import (
    TransactionLedgerResponse,
    TransactionSummary,
    TransactionUpdate,
)
from app.services.categories import normalized_group_for_transaction

EXCLUDED_TRANSFER_TYPES = ["internal_transfer_candidate", "internal_transfer"]


def get_transaction_ledger(
    session: Session,
    entity_id: str,
    *,
    account_id: str | None = None,
    end_date: date | None = None,
    normalized_group: str | None = None,
    include_transfer_candidates: bool,
    limit: int,
    offset: int,
    reviewed: bool | None = None,
    search: str | None = None,
    start_date: date | None = None,
    status: str | None = None,
    transaction_type: str | None = None,
) -> TransactionLedgerResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    base_query = select(Transaction).where(Transaction.entity_id == entity_id)
    count_query = select(func.count(Transaction.id)).where(Transaction.entity_id == entity_id)

    if start_date is not None:
        base_query = base_query.where(Transaction.transaction_date >= start_date)
        count_query = count_query.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        base_query = base_query.where(Transaction.transaction_date <= end_date)
        count_query = count_query.where(Transaction.transaction_date <= end_date)
    if account_id:
        base_query = base_query.where(Transaction.account_id == account_id)
        count_query = count_query.where(Transaction.account_id == account_id)
    if transaction_type:
        transaction_types = (
            ["spending", "expense"] if transaction_type == "expense" else [transaction_type]
        )
        base_query = base_query.where(Transaction.transaction_type.in_(transaction_types))
        count_query = count_query.where(Transaction.transaction_type.in_(transaction_types))
    if status:
        base_query = base_query.where(Transaction.status == status)
        count_query = count_query.where(Transaction.status == status)
    if reviewed is not None:
        base_query = base_query.where(Transaction.reviewed.is_(reviewed))
        count_query = count_query.where(Transaction.reviewed.is_(reviewed))
    if search:
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            Transaction.merchant_name.ilike(pattern),
            Transaction.description.ilike(pattern),
            Transaction.source_category.ilike(pattern),
            Transaction.notes.ilike(pattern),
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)
    if not include_transfer_candidates:
        base_query = base_query.where(Transaction.transaction_type.not_in(EXCLUDED_TRANSFER_TYPES))
        count_query = count_query.where(
            Transaction.transaction_type.not_in(EXCLUDED_TRANSFER_TYPES)
        )
    if normalized_group:
        matching_ids = [
            transaction.id
            for transaction in session.scalars(base_query).all()
            if normalized_group_for_transaction(transaction) == normalized_group
        ]
        base_query = select(Transaction).where(Transaction.id.in_(matching_ids))
        count_query = select(func.count(Transaction.id)).where(Transaction.id.in_(matching_ids))

    transactions = session.scalars(
        base_query.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    total_count = int(session.scalar(count_query) or 0)
    transfer_ids = matched_transfer_transaction_ids(session, entity_id)

    return TransactionLedgerResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        total_count=total_count,
        returned_count=len(transactions),
        transactions=[serialize_transaction(session, tx, transfer_ids) for tx in transactions],
    )


def matched_transfer_transaction_ids(session: Session, entity_id: str) -> set[str]:
    matches = session.scalars(
        select(InternalTransferMatch).where(InternalTransferMatch.entity_id == entity_id)
    ).all()
    ids: set[str] = set()
    for match in matches:
        ids.add(match.from_transaction_id)
        ids.add(match.to_transaction_id)
    return ids


def serialize_transaction(
    session: Session,
    transaction: Transaction,
    transfer_ids: set[str],
) -> TransactionSummary:
    account = session.get(Account, transaction.account_id)
    if account is None:
        raise ValueError("Transaction references missing account.")

    return TransactionSummary(
        id=transaction.id,
        date=transaction.transaction_date.isoformat(),
        provider=account.provider,
        account_name=account.display_name,
        merchant_name=transaction.merchant_name,
        description=transaction.description,
        amount=format_money(transaction.amount),
        direction=transaction.direction,
        source_category=transaction.source_category,
        normalized_group=normalized_group_for_transaction(transaction),
        status=transaction.status,
        reviewed=transaction.reviewed,
        transaction_type=transaction.transaction_type,
        is_transfer_candidate=transaction.id in transfer_ids
        or transaction.transaction_type == "internal_transfer_candidate",
    )


def update_transaction(
    session: Session,
    entity_id: str,
    transaction_id: str,
    payload: TransactionUpdate,
) -> TransactionSummary:
    transaction = session.get(Transaction, transaction_id)
    if transaction is None or transaction.entity_id != entity_id:
        raise ValueError("Transaction not found.")

    if payload.source_category is not None:
        transaction.source_category = (
            payload.source_category.strip()[:120] or transaction.source_category
        )
    if payload.transaction_type is not None:
        transaction.transaction_type = payload.transaction_type
    if payload.reviewed is not None:
        transaction.reviewed = payload.reviewed
    if payload.notes is not None:
        transaction.notes = payload.notes.strip()[:500]

    session.commit()
    session.refresh(transaction)
    return serialize_transaction(
        session,
        transaction,
        matched_transfer_transaction_ids(session, entity_id),
    )


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
