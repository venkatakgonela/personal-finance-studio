from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, Entity, Transaction
from app.schemas.accounts import AccountsSummaryResponse, AccountSummary, AccountUpdate
from app.services.account_balances import (
    available_for_bills_from_values,
    liability_balance_from_values,
)

ACCOUNT_TYPES = {"current", "savings", "pot", "credit_card", "loan", "bnpl", "unknown"}


def get_accounts_summary(
    session: Session,
    entity_id: str,
    *,
    end_date: date | None = None,
    start_date: date | None = None,
) -> AccountsSummaryResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    accounts = session.scalars(
        select(Account)
        .where(Account.entity_id == entity_id)
        .order_by(Account.provider, Account.display_name)
    ).all()

    summaries = [
        summarize_account(session, account, end_date=end_date, start_date=start_date)
        for account in accounts
    ]
    return AccountsSummaryResponse(entity_id=entity.id, entity_name=entity.name, accounts=summaries)


def summarize_account(
    session: Session,
    account: Account,
    *,
    end_date: date | None = None,
    start_date: date | None = None,
) -> AccountSummary:
    inflow_total = session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account.id,
            Transaction.amount > 0,
        )
    )
    outflow_total = session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account.id,
            Transaction.amount < 0,
        )
    )
    transaction_count = session.scalar(
        select(func.count(Transaction.id)).where(Transaction.account_id == account.id)
    )
    latest_transaction_date = session.scalar(
        select(func.max(Transaction.transaction_date)).where(Transaction.account_id == account.id)
    )
    period_inflow_total = transaction_amount_total(
        session,
        account,
        amount_direction="inflow",
        end_date=end_date,
        start_date=start_date,
    )
    period_outflow_total = transaction_amount_total(
        session,
        account,
        amount_direction="outflow",
        end_date=end_date,
        start_date=start_date,
    )

    inflow = Decimal(inflow_total or 0)
    outflow = Decimal(outflow_total or 0)
    period_inflow = Decimal(period_inflow_total or 0)
    period_outflow = Decimal(period_outflow_total or 0)
    imported_net = (inflow + outflow).quantize(Decimal("0.01"))
    period_net = (period_inflow + period_outflow).quantize(Decimal("0.01"))
    has_transactions = int(transaction_count or 0) > 0
    inferred_balance = imported_net if has_transactions else None
    effective_balance = (
        account.current_balance
        if account.current_balance is not None
        else inferred_balance
    )
    balance_source = "entered" if account.current_balance is not None else "snoop_inferred"
    return AccountSummary(
        id=account.id,
        provider=account.provider,
        display_name=account.display_name,
        source_account_name=account.source_account_name,
        account_type=account.account_type,
        current_balance=format_optional_money(account.current_balance),
        inferred_balance=format_optional_money(inferred_balance),
        effective_balance=format_optional_money(effective_balance),
        balance_source=balance_source if effective_balance is not None else "missing",
        balance_as_of=(
            account.balance_as_of.isoformat()
            if account.balance_as_of
            else latest_transaction_date.isoformat() if latest_transaction_date else None
        ),
        overdraft_limit=format_optional_money(account.overdraft_limit),
        available_balance=format_optional_money(
            available_for_bills_from_values(
                effective_balance,
                account.account_type,
                account.overdraft_limit,
            )
        ),
        liability_balance=format_money(
            liability_balance_from_values(effective_balance, account.account_type)
        ),
        include_in_cash_on_hand=account.include_in_cash_on_hand,
        include_in_forecast=account.include_in_forecast,
        transaction_count=int(transaction_count or 0),
        inflow_total=format_money(inflow),
        outflow_total=format_money(outflow),
        net_total=format_money(imported_net),
        period_inflow_total=format_money(period_inflow),
        period_outflow_total=format_money(period_outflow),
        period_net_total=format_money(period_net),
    )


def transaction_amount_total(
    session: Session,
    account: Account,
    *,
    amount_direction: str,
    end_date: date | None = None,
    start_date: date | None = None,
) -> Decimal:
    statement = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.account_id == account.id,
    )
    if amount_direction == "inflow":
        statement = statement.where(Transaction.amount > 0)
    elif amount_direction == "outflow":
        statement = statement.where(Transaction.amount < 0)
    if start_date is not None:
        statement = statement.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        statement = statement.where(Transaction.transaction_date <= end_date)
    return Decimal(session.scalar(statement) or 0)


def update_account(
    session: Session,
    entity_id: str,
    account_id: str,
    payload: AccountUpdate,
) -> AccountSummary:
    account = session.get(Account, account_id)
    if account is None or account.entity_id != entity_id:
        raise ValueError("Account not found.")

    if payload.account_type is not None:
        if payload.account_type not in ACCOUNT_TYPES:
            raise ValueError(f"Unsupported account type: {payload.account_type}")
        account.account_type = payload.account_type
        if payload.account_type in {"credit_card", "loan", "bnpl"}:
            account.include_in_cash_on_hand = False
            account.include_in_forecast = False

    if payload.current_balance is not None:
        account.current_balance = Decimal(payload.current_balance).quantize(Decimal("0.01"))
    if payload.overdraft_limit is not None:
        account.overdraft_limit = Decimal(payload.overdraft_limit).quantize(Decimal("0.01"))
    if payload.balance_as_of is not None:
        account.balance_as_of = date.fromisoformat(payload.balance_as_of)
    if payload.include_in_cash_on_hand is not None:
        account.include_in_cash_on_hand = payload.include_in_cash_on_hand
    if payload.include_in_forecast is not None:
        account.include_in_forecast = payload.include_in_forecast
    if account.account_type in {"credit_card", "loan", "bnpl"}:
        account.include_in_cash_on_hand = False
        account.include_in_forecast = False

    session.commit()
    return summarize_account(session, account)


def format_optional_money(value: Decimal | None) -> str | None:
    return format_money(value) if value is not None else None


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
