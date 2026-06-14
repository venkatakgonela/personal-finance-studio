from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillInstance, Commitment
from app.services.commitments import detect_recurring_commitments, list_commitments
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
