from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, BillInstance, Commitment, Entity, Transaction
from app.schemas.commitments import CommitmentCreate, CommitmentUpdate
from app.services.commitments import (
    create_manual_commitment,
    delete_commitment,
    detect_recurring_commitments,
    list_commitments,
    update_commitment,
)
from app.services.import_commit import commit_snoop_csv

FIXTURES = Path(__file__).parent / "fixtures"


def test_detect_recurring_commitments_creates_candidate_with_instances(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )

    result = detect_recurring_commitments(db_session, import_result.entity_id)

    assert result.created_count == 1
    assert result.candidate_count == 1
    candidate = result.commitments[0]
    assert candidate.name == "Netflix"
    assert candidate.commitment_type == "subscription"
    assert candidate.frequency == "monthly"
    assert candidate.expected_amount == "16.99"
    assert candidate.next_due_date == "2026-07-01"
    assert candidate.status == "candidate"

    commitment = db_session.scalar(select(Commitment))
    assert commitment is not None
    instances = db_session.scalars(
        select(BillInstance).where(BillInstance.commitment_id == commitment.id)
    ).all()
    assert len(instances) == 4
    assert len([instance for instance in instances if instance.status == "paid"]) == 3
    assert len([instance for instance in instances if instance.status == "planned"]) == 1


def test_detect_recurring_commitments_is_idempotent(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )

    first = detect_recurring_commitments(db_session, import_result.entity_id)
    second = detect_recurring_commitments(db_session, import_result.entity_id)

    assert first.created_count == 1
    assert second.created_count == 0
    assert second.existing_count == 1
    assert second.candidate_count == 1


def test_list_commitments_returns_detected_candidates(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detect_recurring_commitments(db_session, import_result.entity_id)

    response = list_commitments(db_session, import_result.entity_id)

    assert response.entity_name == "Household"
    assert response.total_count == 1
    assert response.commitments[0].name == "Netflix"


def test_create_manual_commitment_supports_missed_bill(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )

    summary = create_manual_commitment(
        db_session,
        import_result.entity_id,
        CommitmentCreate(
            name="Council tax",
            commitment_type="bill",
            frequency="monthly",
            expected_amount="189.00",
            next_due_date="2026-07-05",
        ),
    )

    assert summary.name == "Council tax"
    assert summary.source == "manual"
    assert summary.status == "confirmed"
    assert summary.instance_count == 1
    instance = db_session.scalar(
        select(BillInstance).where(BillInstance.commitment_id == summary.id)
    )
    assert instance is not None
    assert instance.due_date.isoformat() == "2026-07-05"
    assert str(instance.expected_amount) == "189.00"


def test_delete_commitment_removes_planned_instances(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    summary = create_manual_commitment(
        db_session,
        import_result.entity_id,
        CommitmentCreate(
            name="Council tax",
            commitment_type="bill",
            frequency="monthly",
            expected_amount="189.00",
            next_due_date="2026-07-05",
        ),
    )

    deleted = delete_commitment(db_session, import_result.entity_id, summary.id)

    assert deleted.id == summary.id
    assert db_session.get(Commitment, summary.id) is None
    assert (
        db_session.scalar(
            select(func.count())
            .select_from(BillInstance)
            .where(BillInstance.commitment_id == summary.id)
        )
        == 0
    )


def test_create_manual_commitment_supports_finite_bnpl_plan(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )

    summary = create_manual_commitment(
        db_session,
        import_result.entity_id,
        CommitmentCreate(
            name="Klarna sofa",
            commitment_type="bnpl",
            frequency="monthly",
            expected_amount="42.00",
            next_due_date="2026-07-10",
            occurrence_count=3,
        ),
    )

    assert summary.commitment_type == "bnpl"
    assert summary.occurrence_count == 3
    assert summary.instance_count == 3
    instances = db_session.scalars(
        select(BillInstance)
        .where(BillInstance.commitment_id == summary.id)
        .order_by(BillInstance.due_date.asc())
    ).all()
    assert [instance.due_date.isoformat() for instance in instances] == [
        "2026-07-10",
        "2026-08-10",
        "2026-09-10",
    ]


def test_create_commitment_from_transaction_keeps_source_evidence(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    transaction = db_session.scalar(
        select(Transaction.id)
        .where(Transaction.entity_id == import_result.entity_id, Transaction.amount < 0)
        .order_by(Transaction.transaction_date.asc())
    )

    assert transaction is not None
    summary = create_manual_commitment(
        db_session,
        import_result.entity_id,
        CommitmentCreate(
            name="Netflix from transaction",
            commitment_type="subscription",
            category="Streaming",
            frequency="monthly",
            expected_amount="16.99",
            next_due_date="2026-07-01",
            source_transaction_id=transaction,
        ),
    )

    assert summary.source == "transaction"
    assert summary.source_label == "Netflix"
    assert summary.category == "Streaming"
    assert summary.instance_count == 2
    instances = db_session.scalars(
        select(BillInstance)
        .where(BillInstance.commitment_id == summary.id)
        .order_by(BillInstance.due_date.asc())
    ).all()
    assert instances[0].matched_transaction_id == transaction
    assert instances[0].status == "paid"
    assert instances[1].status == "planned"


def test_update_commitment_allows_reference_category_and_amount_edits(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detected = detect_recurring_commitments(db_session, import_result.entity_id).commitments[0]

    summary = update_commitment(
        db_session,
        import_result.entity_id,
        detected.id,
        CommitmentUpdate(
            name="Netflix family",
            category="Streaming",
            expected_amount="19.99",
            next_due_date="2026-07-02",
        ),
    )

    assert summary.name == "Netflix family"
    assert summary.source_label == "Netflix"
    assert summary.category == "Streaming"
    assert summary.expected_amount == "19.99"
    assert summary.next_due_date == "2026-07-02"


def test_legacy_detected_commitment_preserves_bank_label_on_first_rename(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detected = detect_recurring_commitments(db_session, import_result.entity_id).commitments[0]
    commitment = db_session.get(Commitment, detected.id)
    assert commitment is not None
    commitment.source_label = None
    db_session.commit()

    before = list_commitments(db_session, import_result.entity_id).commitments[0]
    assert before.source_label == "Netflix"

    summary = update_commitment(
        db_session,
        import_result.entity_id,
        detected.id,
        CommitmentUpdate(name="Netflix family"),
    )

    assert summary.name == "Netflix family"
    assert summary.source_label == "Netflix"


def test_transaction_backed_commitments_infer_household_categories(
    db_session: Session,
) -> None:
    entity = Entity(name="Household", type="household")
    db_session.add(entity)
    db_session.flush()
    account = Account(
        entity_id=entity.id,
        provider="Test",
        display_name="Current",
        source_account_name="Current",
        account_type="current",
    )
    db_session.add(account)
    db_session.flush()

    rows = [
        ("AQUA CREDIT CARD///", "Flexible", "debt_payment", "Credit cards"),
        ("DVLA-V27GSR///", "Flexible", "spending", "Vehicle tax"),
        ("JOTUTORIALS LTD", "Flexible", "spending", "Kids tuition & school fees"),
        ("British Gas", "Bills", "spending", "Utilities"),
    ]

    for index, row in enumerate(rows, start=1):
        merchant, category, transaction_type, expected_category = row
        transaction = Transaction(
            entity_id=entity.id,
            account_id=account.id,
            transaction_date=date(2026, 6, index),
            merchant_name=merchant,
            description=merchant,
            amount=Decimal("-10.00"),
            direction="out",
            source_category=category,
            transaction_type=transaction_type,
            fingerprint=f"category-{index}",
        )
        db_session.add(transaction)
        db_session.flush()

        summary = create_manual_commitment(
            db_session,
            entity.id,
            CommitmentCreate(
                name=merchant,
                commitment_type="bill",
                frequency="monthly",
                expected_amount="10.00",
                next_due_date="2026-07-01",
                source_transaction_id=transaction.id,
            ),
        )

        assert summary.category == expected_category
