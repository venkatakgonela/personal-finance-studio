from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Entity, ImportLog, Profile, Transaction
from app.schemas.transactions import TransactionUpdate
from app.services.import_commit import commit_snoop_csv
from app.services.transactions import update_transaction

FIXTURES = Path(__file__).parent / "fixtures"


def test_commit_snoop_csv_creates_household_accounts_and_transactions(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    result = commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)

    assert result.entity_name == "Household"
    assert result.profile_name == "Primary user"
    assert result.row_count == 5
    assert result.imported_transaction_count == 5
    assert result.skipped_duplicate_count == 0
    assert result.created_account_count == 2

    assert db_session.scalar(select(Entity).where(Entity.name == "Household")) is not None
    assert db_session.scalar(select(Profile).where(Profile.name == "Primary user")) is not None
    assert len(db_session.scalars(select(Account)).all()) == 2
    assert len(db_session.scalars(select(Transaction)).all()) == 5
    assert len(db_session.scalars(select(ImportLog)).all()) == 1


def test_commit_snoop_csv_is_idempotent_by_transaction_fingerprint(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    first = commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)
    second = commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)

    assert first.imported_transaction_count == 5
    assert second.imported_transaction_count == 0
    assert second.skipped_duplicate_count == 5
    assert second.created_account_count == 0
    assert len(db_session.scalars(select(Transaction)).all()) == 5
    assert len(db_session.scalars(select(ImportLog)).all()) == 2


def test_duplicate_snoop_import_preserves_reviewed_transaction_updates(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    first = commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)
    transaction = db_session.scalar(
        select(Transaction).where(Transaction.source_category == "Groceries")
    )
    assert transaction is not None

    update_transaction(
        db_session,
        first.entity_id,
        transaction.id,
        TransactionUpdate(transaction_type="family_transfer", reviewed=True),
    )
    second = commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)
    db_session.refresh(transaction)

    assert second.imported_transaction_count == 0
    assert second.skipped_duplicate_count == 5
    assert transaction.transaction_type == "family_transfer"
    assert transaction.reviewed is True
    assert len(db_session.scalars(select(Transaction)).all()) == 5


def test_repeated_snoop_rows_are_imported_once_and_remain_idempotent(
    db_session: Session,
) -> None:
    original = (FIXTURES / "snoop_minimal.csv").read_text()
    duplicate_first_transaction = "\n".join([original.strip(), original.splitlines()[1]]) + "\n"
    contents = duplicate_first_transaction.encode("utf-8")

    first = commit_snoop_csv(contents, source_filename="duplicate.csv", session=db_session)
    second = commit_snoop_csv(contents, source_filename="duplicate.csv", session=db_session)

    assert first.row_count == 6
    assert first.imported_transaction_count == 6
    assert first.skipped_duplicate_count == 0
    assert second.imported_transaction_count == 0
    assert second.skipped_duplicate_count == 6
    assert len(db_session.scalars(select(Transaction)).all()) == 6


def test_commit_marks_initial_transaction_types(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    commit_snoop_csv(contents, source_filename="snoop_minimal.csv", session=db_session)

    transactions = db_session.scalars(select(Transaction)).all()
    by_category = {transaction.source_category: transaction for transaction in transactions}
    assert by_category["Groceries"].transaction_type == "spending"
    assert by_category["Income"].transaction_type == "income"
    assert by_category["Internal Transfers"].transaction_type == "internal_transfer_candidate"
    assert by_category["Finances"].transaction_type == "debt_payment"
