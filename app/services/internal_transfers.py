from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Account, Entity, InternalTransferMatch, Transaction
from app.schemas.transfers import (
    InternalTransferCandidate,
    InternalTransferDetectionResult,
    TransferTransactionSummary,
)

MAX_TRANSFER_DATE_GAP_DAYS = 3
DEFAULT_CANDIDATE_LIMIT = 50


def detect_internal_transfers(
    session: Session,
    entity_id: str,
    *,
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
) -> InternalTransferDetectionResult:
    transactions = session.scalars(
        select(Transaction)
        .where(
            Transaction.entity_id == entity_id,
            Transaction.transaction_type.in_(["internal_transfer_candidate", "needs_review"]),
        )
        .order_by(Transaction.transaction_date.asc())
    ).all()

    outflows = [transaction for transaction in transactions if transaction.amount < 0]
    inflows = [transaction for transaction in transactions if transaction.amount > 0]
    created_count = 0
    existing_count = 0
    reserved_transaction_ids = matched_transfer_transaction_ids(session, entity_id)

    for outflow in outflows:
        if outflow.id in reserved_transaction_ids:
            continue

        match = best_inflow_match(outflow, inflows, reserved_transaction_ids)
        if match is None:
            continue

        inflow, confidence, reason = match
        if transfer_match_exists(session, entity_id, outflow.id, inflow.id):
            existing_count += 1
            continue

        session.add(
            InternalTransferMatch(
                entity_id=entity_id,
                from_transaction_id=outflow.id,
                to_transaction_id=inflow.id,
                amount=abs(outflow.amount),
                date_gap_days=abs((inflow.transaction_date - outflow.transaction_date).days),
                confidence=confidence,
                reason=reason,
            )
        )
        created_count += 1
        reserved_transaction_ids.add(outflow.id)
        reserved_transaction_ids.add(inflow.id)

    session.commit()
    candidate_count = count_internal_transfer_candidates(session, entity_id)
    candidates = list_internal_transfer_candidates(session, entity_id, limit=candidate_limit)
    return InternalTransferDetectionResult(
        entity_id=entity_id,
        created_count=created_count,
        existing_count=existing_count,
        candidate_count=candidate_count,
        candidates=candidates,
    )


def list_internal_transfer_candidates(
    session: Session,
    entity_id: str,
    *,
    limit: int = DEFAULT_CANDIDATE_LIMIT,
) -> list[InternalTransferCandidate]:
    matches = session.scalars(
        select(InternalTransferMatch)
        .where(InternalTransferMatch.entity_id == entity_id)
        .order_by(InternalTransferMatch.created_at.asc())
        .limit(limit)
    ).all()
    return [serialize_candidate(session, match) for match in matches]


def count_internal_transfer_candidates(session: Session, entity_id: str) -> int:
    return session.scalar(
        select(func.count()).select_from(InternalTransferMatch).where(
            InternalTransferMatch.entity_id == entity_id
        )
    ) or 0


def matched_transfer_transaction_ids(session: Session, entity_id: str) -> set[str]:
    matches = session.scalars(
        select(InternalTransferMatch).where(InternalTransferMatch.entity_id == entity_id)
    ).all()
    transaction_ids: set[str] = set()
    for match in matches:
        transaction_ids.add(match.from_transaction_id)
        transaction_ids.add(match.to_transaction_id)
    return transaction_ids


def best_inflow_match(
    outflow: Transaction,
    inflows: list[Transaction],
    reserved_transaction_ids: set[str],
) -> tuple[Transaction, Decimal, str] | None:
    candidates: list[tuple[Transaction, Decimal, str]] = []
    for inflow in inflows:
        if inflow.id in reserved_transaction_ids:
            continue
        if inflow.account_id == outflow.account_id:
            continue
        if abs(inflow.amount + outflow.amount) > Decimal("0.01"):
            continue
        gap_days = abs((inflow.transaction_date - outflow.transaction_date).days)
        if gap_days > MAX_TRANSFER_DATE_GAP_DAYS:
            continue

        confidence = transfer_confidence(outflow, inflow, gap_days)
        reason = build_transfer_reason(outflow.transaction_date, inflow.transaction_date, gap_days)
        candidates.append((inflow, confidence, reason))

    if not candidates:
        return None

    return sorted(
        candidates,
        key=lambda item: (
            -item[1],
            abs((item[0].transaction_date - outflow.transaction_date).days),
        ),
    )[0]


def transfer_confidence(outflow: Transaction, inflow: Transaction, gap_days: int) -> Decimal:
    confidence = Decimal("0.70")
    if gap_days == 0:
        confidence += Decimal("0.15")
    if shared_description_token(outflow, inflow):
        confidence += Decimal("0.10")
    if (
        outflow.source_category == "Internal Transfers"
        or inflow.source_category == "Internal Transfers"
    ):
        confidence += Decimal("0.05")
    return min(confidence, Decimal("0.99"))


def shared_description_token(outflow: Transaction, inflow: Transaction) -> bool:
    left = token_set(f"{outflow.merchant_name} {outflow.description}")
    right = token_set(f"{inflow.merchant_name} {inflow.description}")
    ignored = {"the", "and", "bgc", "kiran", "gonela", "barclays", "hsbc"}
    return bool((left - ignored) & (right - ignored))


def token_set(value: str) -> set[str]:
    return {token for token in value.lower().replace("-", " ").split() if len(token) > 2}


def build_transfer_reason(outflow_date: date, inflow_date: date, gap_days: int) -> str:
    if gap_days == 0:
        return f"Opposite signed transactions for the same amount on {outflow_date.isoformat()}."
    return (
        "Opposite signed transactions for the same amount within "
        f"{gap_days} days: {outflow_date.isoformat()} and {inflow_date.isoformat()}."
    )


def transaction_already_matched(session: Session, transaction_id: str) -> bool:
    return (
        session.scalar(
            select(InternalTransferMatch.id).where(
                or_(
                    InternalTransferMatch.from_transaction_id == transaction_id,
                    InternalTransferMatch.to_transaction_id == transaction_id,
                )
            )
        )
        is not None
    )


def transfer_match_exists(
    session: Session,
    entity_id: str,
    from_transaction_id: str,
    to_transaction_id: str,
) -> bool:
    return (
        session.scalar(
            select(InternalTransferMatch.id).where(
                InternalTransferMatch.entity_id == entity_id,
                InternalTransferMatch.from_transaction_id == from_transaction_id,
                InternalTransferMatch.to_transaction_id == to_transaction_id,
            )
        )
        is not None
    )


def serialize_candidate(
    session: Session,
    match: InternalTransferMatch,
) -> InternalTransferCandidate:
    from_transaction = session.get(Transaction, match.from_transaction_id)
    to_transaction = session.get(Transaction, match.to_transaction_id)
    if from_transaction is None or to_transaction is None:
        raise ValueError("Transfer match references missing transactions.")

    return InternalTransferCandidate(
        id=match.id,
        entity_id=match.entity_id,
        amount=format_money(match.amount),
        date_gap_days=match.date_gap_days,
        confidence=format_money(match.confidence),
        status=match.status,
        reason=match.reason,
        from_transaction=serialize_transaction(session, from_transaction),
        to_transaction=serialize_transaction(session, to_transaction),
    )


def serialize_transaction(session: Session, transaction: Transaction) -> TransferTransactionSummary:
    account = session.get(Account, transaction.account_id)
    if account is None:
        raise ValueError("Transaction references missing account.")

    return TransferTransactionSummary(
        id=transaction.id,
        account_name=account.display_name,
        provider=account.provider,
        date=transaction.transaction_date.isoformat(),
        amount=format_money(transaction.amount),
        merchant_name=transaction.merchant_name,
        description=transaction.description,
    )


def get_household_entity_id(session: Session) -> str:
    entity_id = session.scalar(select(Entity.id).where(Entity.name == "Household"))
    if entity_id is None:
        raise ValueError("Household entity has not been created yet.")
    return entity_id


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
