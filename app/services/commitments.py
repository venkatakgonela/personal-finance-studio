from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from statistics import median
from uuid import uuid4

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
    CommitmentCreate,
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
GENERIC_COMMITMENT_CATEGORIES = {
    "",
    "bill",
    "bills",
    "debt",
    "finances",
    "fixed",
    "flexible",
    "general",
    "needs review",
    "needs_review",
    "non monthly",
    "non_monthly",
    "uncategorized",
}
COMMITMENT_CATEGORY_RULES = [
    (
        "Kids tuition & school fees",
        ("school", "tuition", "tutor", "tutorial", "nursery", "childcare"),
    ),
    ("Council tax", ("council tax",)),
    ("Rent / mortgage", ("rent", "mortgage")),
    (
        "Utilities",
        (
            "british gas",
            "e.on",
            "eon",
            "electric",
            "energy",
            "gas",
            "octopus",
            "thames water",
            "utilita",
            "utilities",
            "water",
        ),
    ),
    (
        "Telecoms",
        ("broadband", "bt ", "ee ", "mobile", "o2", "three", "virgin media", "vodafone"),
    ),
    (
        "Vehicle loan",
        ("car loan", "car finance", "vehicle loan", "vehicle finance", "motor finance"),
    ),
    ("Vehicle insurance", ("car insurance", "vehicle insurance", "motor insurance")),
    ("Vehicle maintenance", ("garage", "mot", "service", "tyre", "vehicle repair", "car repair")),
    ("Vehicle tax", ("dvla", "road tax", "vehicle tax")),
    ("Credit cards", ("amex", "american exp", "aqua", "barclaycard", "credit card", "vanquis")),
    ("BNPL / pay later", ("bnpl", "clearpay", "klarna", "pay later", "pay in 3")),
    ("Debt payments", ("finance", "loan", "updraft")),
    ("Insurance", ("insurance",)),
    ("Healthcare", ("dental", "health", "medical", "optical", "pharmacy")),
    ("Family support", ("family", "support")),
    ("Subscriptions", ("apple", "netflix", "prime", "spotify", "subscription", "youtube")),
    ("Annual / irregular costs", ("annual", "non monthly", "non_monthly", "yearly")),
]


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
            source_label=commitment_source_label(rows[0]),
            commitment_type=commitment_type(rows[0]),
            category=commitment_category(rows[0]),
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
        source_label=commitment_summary_source_label(commitment),
        commitment_type=commitment.commitment_type,
        category=commitment.category,
        frequency=commitment.frequency,
        expected_amount=format_money(commitment.expected_amount),
        next_due_date=commitment.next_due_date.isoformat() if commitment.next_due_date else None,
        end_date=commitment.end_date.isoformat() if commitment.end_date else None,
        occurrence_count=commitment.occurrence_count,
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


def create_manual_commitment(
    session: Session,
    entity_id: str,
    payload: CommitmentCreate,
) -> CommitmentSummary:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    expected_amount = Decimal(payload.expected_amount).quantize(Decimal("0.01"))
    if expected_amount <= 0:
        raise ValueError("Expected amount must be greater than zero.")

    next_due_date = date.fromisoformat(payload.next_due_date)
    end_date = date.fromisoformat(payload.end_date) if payload.end_date else None
    occurrence_count = payload.occurrence_count
    if occurrence_count is not None and occurrence_count < 1:
        raise ValueError("Payment count must be at least one.")
    if end_date is not None and end_date < next_due_date:
        raise ValueError("End date cannot be before the next due date.")
    source = "manual"
    source_key = f"manual:{uuid4()}"
    source_transaction: Transaction | None = None
    if payload.source_transaction_id:
        source_transaction = session.get(Transaction, payload.source_transaction_id)
        if source_transaction is None or source_transaction.entity_id != entity_id:
            raise ValueError("Source transaction not found.")
        if source_transaction.amount >= 0:
            raise ValueError("Only outflow transactions can become recurring commitments.")
        if source_transaction.id in matched_transfer_transaction_ids(session, entity_id):
            raise ValueError("Transfer transactions cannot become recurring commitments.")
        existing = session.scalar(
            select(Commitment).where(
                Commitment.entity_id == entity_id,
                Commitment.source == "transaction",
                Commitment.source_key == f"transaction:{source_transaction.id}",
            )
        )
        if existing is not None:
            return serialize_commitment(session, existing)
        source = "transaction"
        source_key = f"transaction:{source_transaction.id}"

    commitment = Commitment(
        entity_id=entity_id,
        name=payload.name.strip()[:180] or "Manual commitment",
        source_label=commitment_source_label_from_payload(payload.source_label, source_transaction),
        commitment_type=payload.commitment_type,
        category=commitment_category_from_payload(payload.category, source_transaction),
        frequency=payload.frequency,
        expected_amount=expected_amount,
        estimate_method="manual",
        next_due_date=next_due_date,
        end_date=end_date,
        occurrence_count=occurrence_count,
        source=source,
        source_key=source_key,
        status=payload.status,
    )
    session.add(commitment)
    session.flush()
    if source_transaction is not None:
        session.add(
            BillInstance(
                commitment_id=commitment.id,
                entity_id=entity_id,
                due_date=source_transaction.transaction_date,
                expected_amount=expected_amount,
                actual_amount=abs(source_transaction.amount),
                paid_date=source_transaction.transaction_date,
                paid_account_id=source_transaction.account_id,
                status="paid",
                matched_transaction_id=source_transaction.id,
            )
        )
    add_planned_instances(
        session,
        commitment,
        expected_amount,
        next_due_date,
        occurrence_count=occurrence_count,
        end_date=end_date,
    )
    session.commit()
    session.refresh(commitment)
    return serialize_commitment(session, commitment)


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
        if not commitment.source_label and commitment.source != "manual":
            commitment.source_label = commitment.name
        commitment.name = payload.name.strip()[:180] or commitment.name
    if payload.commitment_type is not None:
        commitment.commitment_type = payload.commitment_type
    if payload.category is not None:
        commitment.category = payload.category.strip()[:120] or commitment.category
    if payload.frequency is not None:
        commitment.frequency = payload.frequency
    if payload.expected_amount is not None:
        expected_amount = Decimal(payload.expected_amount).quantize(Decimal("0.01"))
        if expected_amount <= 0:
            raise ValueError("Expected amount must be greater than zero.")
        commitment.expected_amount = expected_amount
    if payload.next_due_date is not None:
        commitment.next_due_date = date.fromisoformat(payload.next_due_date)
    if payload.end_date is not None:
        commitment.end_date = date.fromisoformat(payload.end_date) if payload.end_date else None
    if payload.occurrence_count is not None:
        if payload.occurrence_count < 1:
            raise ValueError("Payment count must be at least one.")
        commitment.occurrence_count = payload.occurrence_count
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
    if commitment.end_date is not None and commitment.next_due_date > commitment.end_date:
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
    return friendly_commitment_name(label)


def commitment_source_label(transaction: Transaction) -> str:
    label = transaction.merchant_name or transaction.description
    return label.strip()[:240] or "Imported transaction"


def commitment_source_label_from_payload(
    source_label: str | None,
    source_transaction: Transaction | None,
) -> str | None:
    if source_label and source_label.strip():
        return source_label.strip()[:240]
    if source_transaction is not None:
        return commitment_source_label(source_transaction)
    return None


def commitment_summary_source_label(commitment: Commitment) -> str | None:
    if commitment.source_label:
        return commitment.source_label
    if commitment.source != "manual":
        return commitment.name
    return None


def friendly_commitment_name(label: str) -> str:
    cleaned = " ".join(
        label.replace("/", " ")
        .replace("\\", " ")
        .replace("*", " ")
        .replace("_", " ")
        .split()
    )
    if cleaned.isupper():
        cleaned = cleaned.title()
    return cleaned[:180] or "Detected commitment"


def commitment_type(transaction: Transaction) -> str:
    label = f"{transaction.merchant_name} {transaction.description}".lower()
    category = transaction.source_category.lower()
    bnpl_tokens = ["bnpl", "clearpay", "klarna", "pay later", "pay in 3"]
    if any(token in label or token in category for token in bnpl_tokens):
        return "bnpl"
    if transaction.transaction_type == "debt_payment":
        if any(token in label for token in ["amex", "barclaycard", "aqua", "vanquis"]):
            return "credit_card_payment"
        return "loan_payment"
    if "subscription" in category:
        return "subscription"
    if any(token in label for token in ["netflix", "spotify", "youtube", "apple", "prime"]):
        return "subscription"
    return "bill"


def commitment_category(transaction: Transaction) -> str:
    inferred_category = inferred_commitment_category(transaction)
    if inferred_category:
        return inferred_category
    source_category = transaction.source_category.strip()
    if source_category.lower() not in GENERIC_COMMITMENT_CATEGORIES:
        return source_category[:120]
    return title_for_commitment_type(commitment_type(transaction))


def commitment_category_from_payload(
    category: str | None,
    source_transaction: Transaction | None,
) -> str:
    if category and category.strip():
        return category.strip()[:120]
    if source_transaction is not None:
        return commitment_category(source_transaction)
    return "Home & utilities"


def title_for_commitment_type(commitment_type_value: str) -> str:
    titles = {
        "bill": "Home & utilities",
        "bnpl": "BNPL / pay later",
        "credit_card_payment": "Credit cards",
        "loan_payment": "Debt payments",
        "non_monthly": "Annual / irregular costs",
        "subscription": "Subscriptions",
    }
    return titles.get(commitment_type_value, commitment_type_value.replace("_", " ").title())[:120]


def inferred_commitment_category(transaction: Transaction) -> str | None:
    text = (
        f"{transaction.source_category} {transaction.merchant_name} "
        f"{transaction.description} {transaction.sub_type}"
    ).lower()
    for category, tokens in COMMITMENT_CATEGORY_RULES:
        if any(token in text for token in tokens):
            return category
    if transaction.transaction_type == "debt_payment":
        return "Debt payments"
    return None


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


def add_planned_instances(
    session: Session,
    commitment: Commitment,
    expected_amount: Decimal,
    first_due_date,
    *,
    occurrence_count: int | None = None,
    end_date: date | None = None,
) -> None:
    due_date = first_due_date
    added = 0
    max_instances = occurrence_count or 1
    while added < max_instances:
        if end_date is not None and due_date > end_date:
            break
        add_next_planned_instance(session, commitment, expected_amount, due_date)
        added += 1
        due_date = next_due_for_frequency(due_date, commitment.frequency)


def next_due_for_frequency(current: date, frequency: str) -> date:
    if frequency == "weekly":
        return current + timedelta(days=7)
    if frequency == "fortnightly":
        return current + timedelta(days=14)
    if frequency == "quarterly":
        return add_months(current, 3)
    if frequency == "annual":
        return add_months(current, 12)
    if frequency == "monthly":
        return add_months(current, 1)
    return current + timedelta(days=30)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    month_lengths = [31, 29 if is_leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(value.day, month_lengths[month - 1])
    return date(year, month, day)


def is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
