from __future__ import annotations

from decimal import Decimal

from app.models import Account

LIABILITY_ACCOUNT_TYPES = {"credit_card", "loan", "bnpl"}


def is_cash_availability_account(account: Account) -> bool:
    return (
        account.include_in_cash_on_hand
        and account.account_type not in LIABILITY_ACCOUNT_TYPES
    )


def available_for_bills(account: Account) -> Decimal | None:
    return available_for_bills_from_values(
        account.current_balance,
        account.account_type,
        account.overdraft_limit,
    )


def available_for_bills_from_values(
    balance: Decimal | None,
    account_type: str,
    overdraft_limit: Decimal | None = None,
) -> Decimal | None:
    if balance is None:
        return None
    if account_type in LIABILITY_ACCOUNT_TYPES:
        return Decimal("0.00")

    available_overdraft = max(overdraft_limit or Decimal("0.00"), Decimal("0.00"))
    return max(balance + available_overdraft, Decimal("0.00")).quantize(
        Decimal("0.01")
    )


def liability_balance(account: Account) -> Decimal:
    return liability_balance_from_values(account.current_balance, account.account_type)


def liability_balance_from_values(
    balance: Decimal | None,
    account_type: str,
) -> Decimal:
    balance = balance or Decimal("0.00")
    if account_type in LIABILITY_ACCOUNT_TYPES:
        return abs(min(balance, Decimal("0.00"))).quantize(Decimal("0.01"))
    return abs(min(balance, Decimal("0.00"))).quantize(Decimal("0.01"))
