from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from statistics import median

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    BillInstance,
    Commitment,
    Entity,
    InternalTransferMatch,
    Transaction,
)
from app.schemas.commitments import (
    BillInstancePayment,
    BillInstanceSummary,
    CommitmentDetectionResult,
    CommitmentsResponse,
    CommitmentSummary,
    CommitmentUpdate,
)

MIN_RECURRING_TRANSACTIONS = 2
RECENT_PATTERN_WINDOW_DAYS = 120
RECENT_ANNUAL_PATTERN_WINDOW_DAYS = 450
FLEXIBLE_CATEGORY_TOKENS = {
    "clothes",
    "eating",
    "entertainment",
    "general",
    "groceries",
    "health",
    "home",
    "restaurants",
    "shopping",
    "travel",
}
FIXED_CATEGORY_TOKENS = {
    "bill",
    "bills",
    "credit",
    "debt",
    "finance",
    "finances",
    "insurance",
    "loan",
    "mortgage",
    "rent",
    "subscription",
    "subscriptions",
    "tax",
    "utilities",
}
FIXED_LABEL_TOKENS = {
    "amex",
    "apple",
    "aqua",
    "barclaycard",
    "british gas",
    "council tax",
    "dvla",
    "ee",
    "eon",
    "insurance",
    "klarna",
    "loan",
    "netflix",
    "octopus",
    "prime",
    "spotify",
    "updraft",
    "vanquis",
    "vodafone",
    "youtube",
}


def detect_recurring_commitments(session: Session, entity_id: str) -> CommitmentDetectionResult:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    transfer_ids = matched_transfer_transaction_ids(session, entity_id)
    transactions = session.scalars(
        select(Transaction)
        .where(
            Transaction.entity_id == entity_id,
            Transaction.amount < 0,
            Transaction.transaction_type.not_in(
                ["income", "internal_transfer_candidate", "ignored"],
            ),
        )
        .order_by(Transaction.transaction_date.asc())
    ).all()
    latest_transaction_date = max(
        (transaction.transaction_date for transaction in transactions),
        default=None,
    )

    groups: dict[str, list[Transaction]] = defaultdict(list)
    for transaction in transactions:
        if transaction.id in transfer_ids:
            continue
        if not looks_like_commitment(transaction):
            continue
        source_key = recurring_source_key(transaction)
        if source_key is None:
            continue
        groups[source_key].append(transaction)

    created_count = 0
    existing_count = 0
    for source_key, rows in groups.items():
        rows = sorted(rows, key=lambda row: row.transaction_date)
        if len(rows) < MIN_RECURRING_TRANSACTIONS:
            continue

        frequency = infer_frequency(rows)
        if frequency is None:
            continue
        if not is_recent_pattern(rows, frequency, latest_transaction_date):
            continue

        existing = session.scalar(
            select(Commitment).where(
                Commitment.entity_id == entity_id,
                Commitment.source == "detected",
                Commitment.source_key == source_key,
            )
        )
        if existing is not None:
            existing_count += 1
            continue

        expected_amount = estimate_amount(rows)
        next_due_date = rows[-1].transaction_date + timedelta(days=frequency_days(frequency, rows))
        commitment = Commitment(
            entity_id=entity_id,
            name=commitment_name(rows[0]),
            commitment_type=commitment_type(rows[0]),
            frequency=frequency,
            expected_amount=expected_amount,
            estimate_method="recent_average",
            next_due_date=next_due_date,
            source="detected",
            source_key=source_key,
            status="candidate",
        )
        session.add(commitment)
        session.flush()
        add_paid_instances(session, commitment, rows, expected_amount)
        add_next_planned_instance(session, commitment, expected_amount, next_due_date)
        created_count += 1

    session.commit()
    summaries = list_commitment_summaries(session, entity_id, limit=25)
    return CommitmentDetectionResult(
        entity_id=entity_id,
        created_count=created_count,
        existing_count=existing_count,
        candidate_count=count_commitments(session, entity_id),
        commitments=summaries,
    )


def list_commitments(session: Session, entity_id: str, *, limit: int = 50) -> CommitmentsResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    return CommitmentsResponse(
        entity_id=entity.id,
        entity_name=entity.name,
        total_count=count_commitments(session, entity_id),
        commitments=list_commitment_summaries(session, entity_id, limit=limit),
    )


def list_commitment_summaries(
    session: Session,
    entity_id: str,
    *,
    limit: int,
) -> list[CommitmentSummary]:
    commitments = session.scalars(
        select(Commitment)
        .where(Commitment.entity_id == entity_id)
        .order_by(Commitment.next_due_date.asc().nulls_last(), Commitment.name.asc())
        .limit(limit)
    ).all()
    return [serialize_commitment(session, commitment) for commitment in commitments]


def serialize_commitment(session: Session, commitment: Commitment) -> CommitmentSummary:
    instance_count = int(
        session.scalar(
            select(func.count(BillInstance.id)).where(
                BillInstance.commitment_id == commitment.id,
            )
        )
        or 0
    )
    return CommitmentSummary(
        id=commitment.id,
        name=commitment.name,
        commitment_type=commitment.commitment_type,
        frequency=commitment.frequency,
        expected_amount=format_money(commitment.expected_amount),
        next_due_date=commitment.next_due_date.isoformat() if commitment.next_due_date else None,
        status=commitment.status,
        source=commitment.source,
        instance_count=instance_count,
    )


def count_commitments(session: Session, entity_id: str) -> int:
    return int(
        session.scalar(
            select(func.count(Commitment.id)).where(Commitment.entity_id == entity_id)
        )
        or 0
    )


def update_commitment(
    session: Session,
    entity_id: str,
    commitment_id: str,
    payload: CommitmentUpdate,
) -> CommitmentSummary:
    commitment = session.get(Commitment, commitment_id)
    if commitment is None or commitment.entity_id != entity_id:
        raise ValueError("Commitment not found.")

    if payload.name is not None:
        commitment.name = payload.name.strip()[:180] or commitment.name
    if payload.commitment_type is not None:
        commitment.commitment_type = payload.commitment_type
    if payload.frequency is not None:
        commitment.frequency = payload.frequency
    if payload.expected_amount is not None:
        commitment.expected_amount = Decimal(payload.expected_amount).quantize(Decimal("0.01"))
    if payload.next_due_date is not None:
        commitment.next_due_date = date.fromisoformat(payload.next_due_date)
    if payload.status is not None:
        commitment.status = payload.status

    sync_next_planned_instance(session, commitment)
    session.commit()
    session.refresh(commitment)
    return serialize_commitment(session, commitment)


def mark_bill_instance_paid(
    session: Session,
    entity_id: str,
    instance_id: str,
    payload: BillInstancePayment,
) -> BillInstanceSummary:
    instance = session.get(BillInstance, instance_id)
    if instance is None or instance.entity_id != entity_id:
        raise ValueError("Bill instance not found.")

    instance.actual_amount = Decimal(payload.actual_amount).quantize(Decimal("0.01"))
    instance.paid_date = date.fromisoformat(payload.paid_date)
    instance.paid_account_id = payload.paid_account_id
    instance.status = "paid"
    session.commit()
    session.refresh(instance)
    return serialize_bill_instance(instance)


def sync_next_planned_instance(session: Session, commitment: Commitment) -> None:
    if commitment.next_due_date is None:
        return
    instance = session.scalar(
        select(BillInstance).where(
            BillInstance.commitment_id == commitment.id,
            BillInstance.due_date == commitment.next_due_date,
            BillInstance.matched_transaction_id.is_(None),
        )
    )
    if instance is None:
        session.add(
            BillInstance(
                commitment_id=commitment.id,
                entity_id=commitment.entity_id,
                due_date=commitment.next_due_date,
                expected_amount=commitment.expected_amount,
                estimated_amount=commitment.expected_amount,
                status="planned",
            )
        )
        return
    instance.expected_amount = commitment.expected_amount
    instance.estimated_amount = commitment.expected_amount


def serialize_bill_instance(instance: BillInstance) -> BillInstanceSummary:
    return BillInstanceSummary(
        id=instance.id,
        commitment_id=instance.commitment_id,
        due_date=instance.due_date.isoformat(),
        expected_amount=format_money(instance.expected_amount),
        estimated_amount=format_optional_money(instance.estimated_amount),
        actual_amount=format_optional_money(instance.actual_amount),
        paid_date=instance.paid_date.isoformat() if instance.paid_date else None,
        status=instance.status,
    )


def format_optional_money(value: Decimal | None) -> str | None:
    return format_money(value) if value is not None else None


def matched_transfer_transaction_ids(session: Session, entity_id: str) -> set[str]:
    matches = session.scalars(
        select(InternalTransferMatch).where(InternalTransferMatch.entity_id == entity_id)
    ).all()
    ids: set[str] = set()
    for match in matches:
        ids.add(match.from_transaction_id)
        ids.add(match.to_transaction_id)
    return ids


def recurring_source_key(transaction: Transaction) -> str | None:
    label = transaction.merchant_name or transaction.description
    normalized = normalize_label(label)
    if not normalized or len(normalized) < 3:
        return None
    return f"{transaction.account_id}:{normalized}"


def normalize_label(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", value.lower())
    cleaned = re.sub(r"\b\d{2,}\b", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:100]


def infer_frequency(rows: list[Transaction]) -> str | None:
    if len(rows) < 2:
        return None

    gaps = [
        (right.transaction_date - left.transaction_date).days
        for left, right in zip(rows, rows[1:], strict=False)
        if (right.transaction_date - left.transaction_date).days > 0
    ]
    if not gaps:
        return None

    typical_gap = median(gaps)
    if 5 <= typical_gap <= 9:
        return "weekly"
    if 25 <= typical_gap <= 35:
        return "monthly"
    if 80 <= typical_gap <= 100:
        return "quarterly"
    if 330 <= typical_gap <= 400:
        return "annual"
    return None


def frequency_days(frequency: str, rows: list[Transaction]) -> int:
    if frequency == "weekly":
        return 7
    if frequency == "monthly":
        return 30
    if frequency == "quarterly":
        return 90
    if frequency == "annual":
        return 365
    gaps = [
        (right.transaction_date - left.transaction_date).days
        for left, right in zip(rows, rows[1:], strict=False)
        if (right.transaction_date - left.transaction_date).days > 0
    ]
    return int(median(gaps)) if gaps else 30


def estimate_amount(rows: list[Transaction]) -> Decimal:
    recent = rows[-3:]
    total = sum((abs(row.amount) for row in recent), Decimal("0.00"))
    return (total / Decimal(len(recent))).quantize(Decimal("0.01"))


def commitment_name(transaction: Transaction) -> str:
    label = transaction.merchant_name or transaction.description
    return label.strip()[:180] or "Detected commitment"


def commitment_type(transaction: Transaction) -> str:
    label = f"{transaction.merchant_name} {transaction.description}".lower()
    category = transaction.source_category.lower()
    if transaction.transaction_type == "debt_payment":
        if any(token in label for token in ["amex", "barclaycard", "aqua", "vanquis"]):
            return "credit_card_payment"
        return "loan_payment"
    if "subscription" in category:
        return "subscription"
    if any(token in label for token in ["netflix", "spotify", "youtube", "apple", "prime"]):
        return "subscription"
    return "bill"


def looks_like_commitment(transaction: Transaction) -> bool:
    if transaction.transaction_type == "debt_payment":
        return True

    label = f"{transaction.merchant_name} {transaction.description}".lower()
    category = transaction.source_category.lower()
    if any(token in category for token in FIXED_CATEGORY_TOKENS):
        return True
    if any(token in label for token in FIXED_LABEL_TOKENS):
        return True
    if any(token in category for token in FLEXIBLE_CATEGORY_TOKENS):
        return False
    return False


def is_recent_pattern(
    rows: list[Transaction],
    frequency: str,
    latest_transaction_date,
) -> bool:
    if latest_transaction_date is None:
        return False
    stale_window = (
        RECENT_ANNUAL_PATTERN_WINDOW_DAYS
        if frequency == "annual"
        else RECENT_PATTERN_WINDOW_DAYS
    )
    return (latest_transaction_date - rows[-1].transaction_date).days <= stale_window


def add_paid_instances(
    session: Session,
    commitment: Commitment,
    rows: list[Transaction],
    expected_amount: Decimal,
) -> None:
    for row in rows:
        session.add(
            BillInstance(
                commitment_id=commitment.id,
                entity_id=commitment.entity_id,
                due_date=row.transaction_date,
                expected_amount=expected_amount,
                actual_amount=abs(row.amount),
                paid_date=row.transaction_date,
                paid_account_id=row.account_id,
                status="paid",
                matched_transaction_id=row.id,
            )
        )


def add_next_planned_instance(
    session: Session,
    commitment: Commitment,
    expected_amount: Decimal,
    next_due_date,
) -> None:
    session.add(
        BillInstance(
            commitment_id=commitment.id,
            entity_id=commitment.entity_id,
            due_date=next_due_date,
            expected_amount=expected_amount,
            estimated_amount=expected_amount,
            status="planned",
        )
    )


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
