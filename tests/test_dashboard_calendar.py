from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Commitment
from app.schemas.accounts import AccountUpdate
from app.services.accounts import get_accounts_summary, update_account
from app.services.calendar import list_upcoming_commitments
from app.services.commitments import detect_recurring_commitments
from app.services.dashboard import get_dashboard_summary
from app.services.decisions import confirm_decision
from app.services.import_commit import commit_snoop_csv

FIXTURES = Path(__file__).parent / "fixtures"


def test_dashboard_summary_requires_balances_then_calculates_cash(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    account = get_accounts_summary(db_session, import_result.entity_id).accounts[0]

    initial = get_dashboard_summary(db_session, import_result.entity_id)
    assert initial.cash_on_hand is None
    assert initial.confidence == "needs_balance_review"

    update_account(
        db_session,
        import_result.entity_id,
        account.id,
        AccountUpdate(
            account_type="current",
            current_balance="1000.25",
            balance_as_of="2026-06-14",
        ),
    )

    updated = get_dashboard_summary(db_session, import_result.entity_id)
    assert updated.cash_on_hand == "1000.25"
    assert updated.confidence == "ready"


def test_dashboard_and_calendar_use_confirmed_and_candidate_commitments(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    detect_recurring_commitments(db_session, import_result.entity_id)
    commitment = db_session.scalar(select(Commitment))
    assert commitment is not None

    candidate_summary = get_dashboard_summary(db_session, import_result.entity_id)
    assert candidate_summary.upcoming_candidate_total == "16.99"
    assert candidate_summary.upcoming_confirmed_total == "0.00"

    candidate_calendar = list_upcoming_commitments(db_session, import_result.entity_id)
    assert candidate_calendar.total_count == 1
    assert candidate_calendar.expected_total == "16.99"

    confirm_decision(
        db_session,
        import_result.entity_id,
        "recurring_commitment",
        commitment.id,
    )

    confirmed_summary = get_dashboard_summary(db_session, import_result.entity_id)
    assert confirmed_summary.upcoming_candidate_total == "0.00"
    assert confirmed_summary.upcoming_confirmed_total == "16.99"

    confirmed_calendar = list_upcoming_commitments(
        db_session,
        import_result.entity_id,
        include_candidates=False,
    )
    assert confirmed_calendar.total_count == 1
    assert confirmed_calendar.items[0].commitment_status == "confirmed"
