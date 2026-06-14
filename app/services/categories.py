from __future__ import annotations

from decimal import Decimal

from app.models import Transaction

INCOME_TOKENS = {"salary", "income", "pay", "wages", "interest"}
TRANSFER_TOKENS = {"internal transfer", "transfer", "self-bills", "savings"}
DEBT_TOKENS = {"credit", "loan", "finance", "bnpl", "klarna", "card", "mortgage"}
FIXED_TOKENS = {
    "bill",
    "bills",
    "utilities",
    "subscription",
    "subscriptions",
    "insurance",
    "rent",
    "tax",
    "council",
    "mobile",
    "broadband",
}
NON_MONTHLY_TOKENS = {"annual", "yearly", "dvla", "mot", "car tax", "insurance"}
FLEXIBLE_TOKENS = {
    "groceries",
    "shopping",
    "eating",
    "restaurant",
    "restaurants",
    "transport",
    "fuel",
    "entertainment",
    "cash",
}


def normalized_group_for_transaction(transaction: Transaction) -> str:
    return normalized_group(
        source_category=transaction.source_category,
        merchant_name=transaction.merchant_name,
        description=transaction.description,
        transaction_type=transaction.transaction_type,
        amount=transaction.amount,
    )


def normalized_group(
    *,
    source_category: str,
    merchant_name: str,
    description: str,
    transaction_type: str,
    amount: Decimal,
) -> str:
    text = f"{source_category} {merchant_name} {description}".lower()

    if transaction_type in {"internal_transfer", "internal_transfer_candidate"}:
        return "transfer"
    if transaction_type == "ignored":
        return "ignored"
    if transaction_type == "debt_payment":
        return "debt"
    if amount > 0 or any(token in text for token in INCOME_TOKENS):
        return "income"
    if any(token in text for token in TRANSFER_TOKENS):
        return "transfer"
    if any(token in text for token in DEBT_TOKENS):
        return "debt"
    if any(token in text for token in NON_MONTHLY_TOKENS):
        return "non_monthly"
    if any(token in text for token in FIXED_TOKENS):
        return "fixed"
    if any(token in text for token in FLEXIBLE_TOKENS):
        return "flexible"
    return "flexible" if amount < 0 else "income"
