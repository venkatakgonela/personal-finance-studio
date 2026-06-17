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
    assert initial.cash_on_hand == "1150.04"
    assert initial.confidence == "inferred_balance"

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


def test_overdraft_limit_counts_for_bill_payment_capacity_but_balance_stays_negative(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_recurring.csv",
        session=db_session,
    )
    account = get_accounts_summary(db_session, import_result.entity_id).accounts[0]

    updated_account = update_account(
        db_session,
        import_result.entity_id,
        account.id,
        AccountUpdate(
            account_type="current",
            current_balance="-409.88",
            overdraft_limit="1000.00",
            balance_as_of="2026-06-14",
        ),
    )
    dashboard = get_dashboard_summary(db_session, import_result.entity_id)

    assert updated_account.current_balance == "-409.88"
    assert updated_account.overdraft_limit == "1000.00"
    assert updated_account.available_balance == "590.12"
    assert updated_account.liability_balance == "409.88"
    assert dashboard.cash_on_hand == "590.12"


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
