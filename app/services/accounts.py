from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, Entity, Transaction
from app.schemas.accounts import AccountsSummaryResponse, AccountSummary, AccountUpdate
from app.services.account_balances import available_for_bills, liability_balance

ACCOUNT_TYPES = {"current", "savings", "pot", "credit_card", "loan", "bnpl", "unknown"}


def get_accounts_summary(session: Session, entity_id: str) -> AccountsSummaryResponse:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    accounts = session.scalars(
        select(Account)
        .where(Account.entity_id == entity_id)
        .order_by(Account.provider, Account.display_name)
    ).all()

    summaries = [summarize_account(session, account) for account in accounts]
    return AccountsSummaryResponse(entity_id=entity.id, entity_name=entity.name, accounts=summaries)


def summarize_account(session: Session, account: Account) -> AccountSummary:
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

    inflow = Decimal(inflow_total or 0)
    outflow = Decimal(outflow_total or 0)
    return AccountSummary(
        id=account.id,
        provider=account.provider,
        display_name=account.display_name,
        source_account_name=account.source_account_name,
        account_type=account.account_type,
        current_balance=format_optional_money(account.current_balance),
        overdraft_limit=format_optional_money(account.overdraft_limit),
        available_balance=format_optional_money(available_for_bills(account)),
        liability_balance=format_money(liability_balance(account)),
        include_in_cash_on_hand=account.include_in_cash_on_hand,
        include_in_forecast=account.include_in_forecast,
        transaction_count=int(transaction_count or 0),
        inflow_total=format_money(inflow),
        outflow_total=format_money(outflow),
        net_total=format_money(inflow + outflow),
    )


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
