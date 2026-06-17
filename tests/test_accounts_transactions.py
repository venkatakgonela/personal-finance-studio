from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.schemas.accounts import AccountUpdate
from app.services.accounts import get_accounts_summary, update_account
from app.services.import_commit import commit_snoop_csv
from app.services.internal_transfers import detect_internal_transfers
from app.services.transactions import get_transaction_ledger

FIXTURES = Path(__file__).parent / "fixtures"


def test_accounts_summary_returns_detected_accounts_and_totals(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )

    summary = get_accounts_summary(db_session, import_result.entity_id)

    assert summary.entity_name == "Household"
    assert len(summary.accounts) == 2
    hsbc = next(account for account in summary.accounts if account.provider == "HSBC Personal")
    assert hsbc.transaction_count == 4
    assert hsbc.inflow_total == "3250.00"
    assert hsbc.outflow_total == "-388.99"
    assert hsbc.net_total == "2861.01"
    assert hsbc.period_inflow_total == "3250.00"
    assert hsbc.period_outflow_total == "-388.99"
    assert hsbc.period_net_total == "2861.01"
    assert hsbc.current_balance is None
    assert hsbc.inferred_balance == "2861.01"
    assert hsbc.effective_balance == "2861.01"
    assert hsbc.balance_source == "snoop_inferred"


def test_accounts_summary_period_movement_is_date_windowed(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )

    summary = get_accounts_summary(
        db_session,
        import_result.entity_id,
        end_date=date(2026, 6, 10),
        start_date=date(2026, 6, 10),
    )

    hsbc = next(account for account in summary.accounts if account.provider == "HSBC Personal")
    assert hsbc.net_total == "2861.01"
    assert hsbc.effective_balance == "2861.01"
    assert hsbc.period_inflow_total == "2000.00"
    assert hsbc.period_outflow_total == "-340.00"
    assert hsbc.period_net_total == "1660.00"


def test_update_account_sets_balance_and_excludes_credit_cards(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )
    account = get_accounts_summary(db_session, import_result.entity_id).accounts[0]

    updated = update_account(
        db_session,
        import_result.entity_id,
        account.id,
        AccountUpdate(
            account_type="credit_card",
            current_balance="-120.55",
            balance_as_of="2026-06-14",
            include_in_cash_on_hand=True,
        ),
    )

    assert updated.account_type == "credit_card"
    assert updated.current_balance == "-120.55"
    assert updated.include_in_cash_on_hand is False
    assert updated.include_in_forecast is False


def test_transaction_ledger_can_filter_transfer_candidates(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )
    detect_internal_transfers(db_session, import_result.entity_id)

    full_ledger = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=True,
        limit=100,
        offset=0,
    )
    filtered_ledger = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=False,
        limit=100,
        offset=0,
    )

    assert full_ledger.total_count == 5
    assert filtered_ledger.total_count == 3
    transfer_count = sum(
        1 for transaction in full_ledger.transactions if transaction.is_transfer_candidate
    )
    assert transfer_count == 2
    assert all(
        not transaction.is_transfer_candidate for transaction in filtered_ledger.transactions
    )


def test_transaction_ledger_supports_finance_filters(db_session: Session) -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()
    import_result = commit_snoop_csv(
        contents,
        source_filename="snoop_minimal.csv",
        session=db_session,
    )

    date_filtered = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        end_date=date(2026, 6, 10),
        include_transfer_candidates=False,
        limit=100,
        offset=0,
        start_date=date(2026, 6, 9),
    )
    search_filtered = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=False,
        limit=100,
        offset=0,
        search="salary",
    )
    group_filtered = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=False,
        limit=100,
        normalized_group="income",
        offset=0,
    )
    spending_type_filtered = get_transaction_ledger(
        db_session,
        import_result.entity_id,
        include_transfer_candidates=False,
        limit=100,
        offset=0,
        transaction_type="expense",
    )

    assert date_filtered.total_count == 2
    assert search_filtered.total_count == 1
    assert group_filtered.total_count == 1
    assert group_filtered.transactions[0].normalized_group == "income"
    assert spending_type_filtered.total_count == 1
    assert spending_type_filtered.transactions[0].transaction_type == "spending"
