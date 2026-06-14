from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillInstance, Transaction
from app.schemas.accounts import AccountUpdate
from app.schemas.commitments import BillInstancePayment, CommitmentUpdate
from app.schemas.transactions import TransactionUpdate
from app.services.accounts import get_accounts_summary, update_account
from app.services.commitments import (
    detect_recurring_commitments,
    mark_bill_instance_paid,
    update_commitment,
)
from app.services.forecast import get_cashflow_forecast
from app.services.import_commit import commit_snoop_csv
from app.services.insights import get_insights
from app.services.planning import get_planning_overview
from app.services.transactions import get_transaction_ledger, update_transaction

FIXTURES = Path(__file__).parent / "fixtures"


def test_transaction_review_updates_type_and_category_group(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(contents, source_filename="snoop.csv", session=db_session)
    transaction = db_session.scalar(select(Transaction).where(Transaction.amount < 0))
    assert transaction is not None

    updated = update_transaction(
        db_session,
        import_result.entity_id,
        transaction.id,
        TransactionUpdate(transaction_type="ignored", reviewed=True),
    )

    assert updated.transaction_type == "ignored"
    assert updated.reviewed is True
    assert updated.normalized_group == "ignored"


def test_forecast_uses_only_confirmed_commitments_for_projected_balance(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(contents, source_filename="snoop.csv", session=db_session)
    account = get_accounts_summary(db_session, import_result.entity_id).accounts[0]
    update_account(
        db_session,
        import_result.entity_id,
        account.id,
        AccountUpdate(account_type="current", current_balance="100.00"),
    )
    detect_recurring_commitments(db_session, import_result.entity_id)

    candidate_forecast = get_cashflow_forecast(db_session, import_result.entity_id)
    assert candidate_forecast.starting_balance == "100.00"
    assert candidate_forecast.projected_ending_balance == "100.00"
    assert candidate_forecast.candidate_commitments_total == "16.99"

    commitment_id = candidate_forecast.points[0].label
    commitment = next(
        item
        for item in detect_recurring_commitments(db_session, import_result.entity_id).commitments
        if item.name == commitment_id
    )
    update_commitment(
        db_session,
        import_result.entity_id,
        commitment.id,
        CommitmentUpdate(status="confirmed"),
    )

    confirmed_forecast = get_cashflow_forecast(db_session, import_result.entity_id)
    assert confirmed_forecast.confirmed_commitments_total == "16.99"
    assert confirmed_forecast.projected_ending_balance == "83.01"


def test_mark_bill_instance_paid_and_insights_exclude_transfers(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(contents, source_filename="snoop.csv", session=db_session)
    detect_recurring_commitments(db_session, import_result.entity_id)
    instance = db_session.scalar(select(BillInstance).where(BillInstance.status == "planned"))
    assert instance is not None

    paid = mark_bill_instance_paid(
        db_session,
        import_result.entity_id,
        instance.id,
        BillInstancePayment(actual_amount="18.50", paid_date="2026-06-14"),
    )
    assert paid.status == "paid"
    assert paid.actual_amount == "18.50"

    ledger = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=False,
        limit=100,
        offset=0,
    )
    assert all(transaction.normalized_group != "transfer" for transaction in ledger.transactions)

    insights = get_insights(db_session, import_result.entity_id)
    assert insights.internal_transfers_excluded is True
    assert insights.income_sources
    assert any(group.group in {"fixed", "flexible", "debt"} for group in insights.category_groups)
    assert insights.merchant_breakdowns
    assert all(
        item.group not in {"income", "transfer", "ignored"}
        for item in insights.merchant_breakdowns
    )


def test_phase_1_5_planning_overview_derives_review_and_saved_filters(
    db_session: Session,
) -> None:
    contents = (FIXTURES / "snoop_recurring.csv").read_bytes()
    import_result = commit_snoop_csv(contents, source_filename="snoop.csv", session=db_session)
    account = get_accounts_summary(db_session, import_result.entity_id).accounts[0]
    update_account(
        db_session,
        import_result.entity_id,
        account.id,
        AccountUpdate(account_type="current", current_balance="1000.00"),
    )
    detection = detect_recurring_commitments(db_session, import_result.entity_id)
    commitment = detection.commitments[0]
    update_commitment(
        db_session,
        import_result.entity_id,
        commitment.id,
        CommitmentUpdate(name="Annual Membership", frequency="annual", status="confirmed"),
    )

    overview = get_planning_overview(db_session, import_result.entity_id)

    assert overview.goals
    assert overview.monthly_review.start_date.endswith("-01")
    assert overview.import_freshness.status == "fresh"
    assert any(fund.name == "Annual Membership" for fund in overview.sinking_funds)
    assert any(item.name == "Annual Membership" for item in overview.subscriptions)
    assert any(saved.route == "transactions" for saved in overview.saved_filters)
