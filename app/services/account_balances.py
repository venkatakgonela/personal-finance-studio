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
    if account.current_balance is None:
        return None
    if account.account_type in LIABILITY_ACCOUNT_TYPES:
        return Decimal("0.00")

    overdraft_limit = max(account.overdraft_limit or Decimal("0.00"), Decimal("0.00"))
    return max(account.current_balance + overdraft_limit, Decimal("0.00")).quantize(
        Decimal("0.01")
    )


def liability_balance(account: Account) -> Decimal:
    balance = account.current_balance or Decimal("0.00")
    if account.account_type in LIABILITY_ACCOUNT_TYPES:
        return abs(min(balance, Decimal("0.00"))).quantize(Decimal("0.01"))
    return abs(min(balance, Decimal("0.00"))).quantize(Decimal("0.01"))
