from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Commitment, Entity, InternalTransferMatch, Transaction
from app.schemas.decisions import DecisionActionResult, DecisionItem, DecisionQueueResponse

TRANSFER_DECISION = "internal_transfer"
COMMITMENT_DECISION = "recurring_commitment"


def list_decisions(session: Session, entity_id: str, *, limit: int = 25) -> DecisionQueueResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    transfer_decisions = list_transfer_decisions(session, entity_id, limit=limit)
    remaining_limit = max(limit - len(transfer_decisions), 0)
    commitment_decisions = list_commitment_decisions(session, entity_id, limit=remaining_limit)
    decisions = transfer_decisions + commitment_decisions

    return DecisionQueueResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        total_count=count_decisions(session, entity_id),
        decisions=decisions,
    )


def confirm_decision(
    session: Session,
    entity_id: str,
    decision_type: str,
    decision_id: str,
) -> DecisionActionResult:
    if decision_type == TRANSFER_DECISION:
        return confirm_transfer_candidate(session, entity_id, decision_id)
    if decision_type == COMMITMENT_DECISION:
        return update_commitment_candidate(session, entity_id, decision_id, "confirmed")
    raise ValueError(f"Unsupported decision type: {decision_type}")


def reject_decision(
    session: Session,
    entity_id: str,
    decision_type: str,
    decision_id: str,
) -> DecisionActionResult:
    if decision_type == TRANSFER_DECISION:
        return reject_transfer_candidate(session, entity_id, decision_id)
    if decision_type == COMMITMENT_DECISION:
        return update_commitment_candidate(session, entity_id, decision_id, "rejected")
    raise ValueError(f"Unsupported decision type: {decision_type}")


def list_transfer_decisions(session: Session, entity_id: str, *, limit: int) -> list[DecisionItem]:
    matches = session.scalars(
        select(InternalTransferMatch)
        .where(
            InternalTransferMatch.entity_id == entity_id,
            InternalTransferMatch.status == "candidate",
        )
        .order_by(InternalTransferMatch.created_at.desc())
    ).all()

    sortable_decisions: list[tuple[DecisionItem, str]] = []
    for match in matches:
        from_transaction = session.get(Transaction, match.from_transaction_id)
        to_transaction = session.get(Transaction, match.to_transaction_id)
        if from_transaction is None or to_transaction is None:
            continue
        decision = DecisionItem(
            id=match.id,
            decision_type=TRANSFER_DECISION,
            title="Confirm internal transfer",
            detail=(
                f"{from_transaction.transaction_date.isoformat()} · "
                f"{from_transaction.description or from_transaction.merchant_name} -> "
                f"{to_transaction.description or to_transaction.merchant_name}"
            ),
            amount=format_money(match.amount),
            status=match.status,
            reason=match.reason,
        )
        sortable_decisions.append((decision, from_transaction.transaction_date.isoformat()))

    return [
        decision
        for decision, _date in sorted(
            sortable_decisions,
            key=lambda item: item[1],
            reverse=True,
        )[:limit]
    ]


def list_commitment_decisions(
    session: Session,
    entity_id: str,
    *,
    limit: int,
) -> list[DecisionItem]:
    if limit <= 0:
        return []

    commitments = session.scalars(
        select(Commitment)
        .where(Commitment.entity_id == entity_id, Commitment.status == "candidate")
        .order_by(Commitment.next_due_date.asc().nulls_last(), Commitment.name.asc())
        .limit(limit)
    ).all()

    decisions: list[DecisionItem] = []
    for commitment in commitments:
        next_due_date = (
            commitment.next_due_date.isoformat() if commitment.next_due_date else "unknown"
        )
        detail = (
            f"{commitment.frequency} {commitment.commitment_type} · next {next_due_date}"
        )
        decisions.append(
            DecisionItem(
                id=commitment.id,
                decision_type=COMMITMENT_DECISION,
                title=f"Confirm {commitment.name}",
                detail=detail,
                amount=format_money(commitment.expected_amount),
                status=commitment.status,
                reason="Detected from repeated transactions. Confirm before using it in forecasts.",
            )
        )
    return decisions


def count_decisions(session: Session, entity_id: str) -> int:
    transfer_count = int(
        session.scalar(
            select(func.count(InternalTransferMatch.id)).where(
                InternalTransferMatch.entity_id == entity_id,
                InternalTransferMatch.status == "candidate",
            )
        )
        or 0
    )
    commitment_count = int(
        session.scalar(
            select(func.count(Commitment.id)).where(
                Commitment.entity_id == entity_id,
                Commitment.status == "candidate",
            )
        )
        or 0
    )
    return transfer_count + commitment_count


def confirm_transfer_candidate(
    session: Session,
    entity_id: str,
    decision_id: str,
) -> DecisionActionResult:
    match = get_transfer_match(session, entity_id, decision_id)
    match.status = "confirmed"
    for transaction_id in [match.from_transaction_id, match.to_transaction_id]:
        transaction = session.get(Transaction, transaction_id)
        if transaction is not None:
            transaction.transaction_type = "internal_transfer"
            transaction.reviewed = True
    session.commit()
    return DecisionActionResult(
        id=match.id,
        decision_type=TRANSFER_DECISION,
        status=match.status,
        message="Internal transfer confirmed and excluded from spending.",
    )


def reject_transfer_candidate(
    session: Session,
    entity_id: str,
    decision_id: str,
) -> DecisionActionResult:
    match = get_transfer_match(session, entity_id, decision_id)
    match.status = "rejected"
    for transaction_id in [match.from_transaction_id, match.to_transaction_id]:
        transaction = session.get(Transaction, transaction_id)
        if (
            transaction is not None
            and transaction.transaction_type == "internal_transfer_candidate"
        ):
            transaction.transaction_type = "needs_review"
    session.commit()
    return DecisionActionResult(
        id=match.id,
        decision_type=TRANSFER_DECISION,
        status=match.status,
        message="Internal transfer candidate rejected.",
    )


def update_commitment_candidate(
    session: Session,
    entity_id: str,
    decision_id: str,
    status: str,
) -> DecisionActionResult:
    commitment = session.get(Commitment, decision_id)
    if commitment is None or commitment.entity_id != entity_id:
        raise ValueError("Commitment decision not found.")
    if commitment.status not in {"candidate", status}:
        raise ValueError(f"Commitment is already {commitment.status}.")

    commitment.status = status
    session.commit()
    return DecisionActionResult(
        id=commitment.id,
        decision_type=COMMITMENT_DECISION,
        status=commitment.status,
        message=f"Recurring commitment {status}.",
    )


def get_transfer_match(
    session: Session,
    entity_id: str,
    decision_id: str,
) -> InternalTransferMatch:
    match = session.get(InternalTransferMatch, decision_id)
    if match is None or match.entity_id != entity_id:
        raise ValueError("Transfer decision not found.")
    if match.status not in {"candidate", "confirmed", "rejected"}:
        raise ValueError(f"Transfer decision has unsupported status: {match.status}.")
    return match


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
