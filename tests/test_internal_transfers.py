from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InternalTransferMatch, Transaction
from app.services.import_commit import commit_snoop_csv
from app.services.internal_transfers import detect_internal_transfers

FIXTURES = Path(__file__).parent / "fixtures"


def test_detect_internal_transfers_links_pair_as_single_candidate(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )

    result = detect_internal_transfers(db_session, import_result.entity_id)

    assert result.created_count == 1
    assert result.candidate_count == 1
    assert len(result.candidates) == 1
    candidate = result.candidates[0]
    assert candidate.amount == "340.00"
    assert candidate.date_gap_days == 0
    assert candidate.from_transaction.amount == "-340.00"
    assert candidate.to_transaction.amount == "340.00"
    assert candidate.from_transaction.provider == "HSBC Personal"
    assert candidate.to_transaction.provider == "Barclays Personal Banking"


def test_detect_internal_transfers_is_idempotent(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )

    first = detect_internal_transfers(db_session, import_result.entity_id)
    second = detect_internal_transfers(db_session, import_result.entity_id)

    assert first.created_count == 1
    assert second.created_count == 0
    assert second.candidate_count == 1
    assert len(db_session.scalars(select(InternalTransferMatch)).all()) == 1


def test_detect_internal_transfers_does_not_match_same_account(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )
    transfer_inflow = db_session.scalar(select(Transaction).where(Transaction.amount == 340))
    assert transfer_inflow is not None
    transfer_inflow.account_id = db_session.scalar(
        select(Transaction.account_id).where(Transaction.amount == -340)
    )
    db_session.commit()

    result = detect_internal_transfers(db_session, import_result.entity_id)

    assert result.created_count == 0
    assert result.candidate_count == 0
    assert result.candidates == []
