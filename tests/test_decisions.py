from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Commitment, InternalTransferMatch, Transaction
from app.services.commitments import detect_recurring_commitments
from app.services.decisions import confirm_decision, list_decisions, reject_decision
from app.services.import_commit import commit_snoop_csv
from app.services.internal_transfers import detect_internal_transfers

FIXTURES = Path(__file__).parent / "fixtures"


def test_decision_queue_lists_transfer_and_commitment_candidates(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )
    detect_internal_transfers(db_session, import_result.entity_id)

    recurring_contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    commit_snoop_csv(
        recurring_contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detect_recurring_commitments(db_session, import_result.entity_id)

    response = list_decisions(db_session, import_result.entity_id)

    assert response.total_count == 2
    assert [decision.decision_type for decision in response.decisions] == [
        "internal_transfer",
        "recurring_commitment",
    ]


def test_confirm_transfer_decision_marks_transactions_internal_transfer(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )
    detect_internal_transfers(db_session, import_result.entity_id)
    match = db_session.scalar(select(InternalTransferMatch))
    assert match is not None

    result = confirm_decision(db_session, import_result.entity_id, "internal_transfer", match.id)

    assert result.status == "confirmed"
    transactions = db_session.scalars(
        select(Transaction).where(
            Transaction.id.in_([match.from_transaction_id, match.to_transaction_id])
        )
    ).all()
    assert {transaction.transaction_type for transaction in transactions} == {"internal_transfer"}
    assert all(transaction.reviewed for transaction in transactions)
    assert list_decisions(db_session, import_result.entity_id).total_count == 0


def test_reject_commitment_decision_removes_it_from_queue(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detect_recurring_commitments(db_session, import_result.entity_id)
    commitment = db_session.scalar(select(Commitment))
    assert commitment is not None

    result = reject_decision(
        db_session,
        import_result.entity_id,
        "recurring_commitment",
        commitment.id,
    )

    assert result.status == "rejected"
    assert list_decisions(db_session, import_result.entity_id).total_count == 0
