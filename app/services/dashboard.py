from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, BillInstance, Commitment, Entity, Transaction
from app.schemas.dashboard import DashboardSummary
from app.services.account_balances import available_for_bills, is_cash_availability_account
from app.services.categories import normalized_group_for_transaction
from app.services.decisions import count_decisions

DASHBOARD_WINDOW_DAYS = 30
FLEXIBLE_SPEND_ALLOWANCE = Decimal("500.00")


def get_dashboard_summary(
    session: Session,
    entity_id: str,
    *,
    today: date | None = None,
) -> DashboardSummary:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    today = today or latest_transaction_date(session, entity_id) or date.today()
    window_end = today + timedelta(days=DASHBOARD_WINDOW_DAYS)

    accounts = session.scalars(
        select(Account).where(Account.entity_id == entity_id, Account.status == "active")
    ).all()
    cash_accounts = [
        account
        for account in accounts
        if is_cash_availability_account(account)
    ]
    accounts_with_balances = [
        account for account in cash_accounts if account.current_balance is not None
    ]
    cash_on_hand = sum(
        (available_for_bills(account) or Decimal("0.00") for account in accounts_with_balances),
        Decimal("0.00"),
    )

    upcoming_confirmed_total = bill_instance_total(
        session,
        entity_id,
        today,
        window_end,
        commitment_status="confirmed",
    )
    upcoming_candidate_total = bill_instance_total(
        session,
        entity_id,
        today,
        window_end,
        commitment_status="candidate",
    )
    decision_count = count_decisions(session, entity_id)
    flexible_spend_actual = flexible_spend_total(
        session,
        entity_id,
        today - timedelta(days=6),
        today,
    )

    missing_balance_count = len(cash_accounts) - len(accounts_with_balances)
    confidence = "ready" if cash_accounts and missing_balance_count == 0 else "needs_balance_review"
    trusted_cash = cash_on_hand if accounts_with_balances and missing_balance_count == 0 else None
    available_after_commitments = (
        trusted_cash - upcoming_confirmed_total if trusted_cash is not None else None
    )
    has_imported_data = bool(accounts) or count_rows(session, Transaction, entity_id) > 0
    flexible_spend_allowance = FLEXIBLE_SPEND_ALLOWANCE if has_imported_data else None
    flexible_spend_remaining = (
        flexible_spend_allowance - flexible_spend_actual
        if flexible_spend_allowance is not None
        else None
    )
    lowest_projected_balance = (
        min(trusted_cash, available_after_commitments)
        if trusted_cash is not None and available_after_commitments is not None
        else None
    )
    message = (
        "Balances are ready for cash-on-hand calculations."
        if confidence == "ready"
        else "Enter current balances for included cash accounts before trusting cash-on-hand."
    )

    return DashboardSummary(
        entity_id=entity.id,
        entity_name=entity.name,
        cash_on_hand=format_optional_money(cash_on_hand if accounts_with_balances else None),
        available_after_commitments=format_optional_money(available_after_commitments),
        flexible_spend_remaining=format_optional_money(flexible_spend_remaining),
        flexible_spend_actual=format_money(flexible_spend_actual),
        flexible_spend_allowance=format_optional_money(flexible_spend_allowance),
        lowest_projected_balance=format_optional_money(lowest_projected_balance),
        cash_balance_account_count=len(accounts_with_balances),
        missing_balance_account_count=missing_balance_count,
        upcoming_confirmed_total=format_money(upcoming_confirmed_total),
        upcoming_candidate_total=format_money(upcoming_candidate_total),
        decision_count=decision_count,
        transaction_count=count_rows(session, Transaction, entity_id),
        account_count=len(accounts),
        commitment_count=count_rows(session, Commitment, entity_id),
        confidence=confidence,
        message=message,
    )


def bill_instance_total(
    session: Session,
    entity_id: str,
    start_date: date,
    end_date: date,
    *,
    commitment_status: str,
) -> Decimal:
    total = session.scalar(
        select(func.coalesce(func.sum(BillInstance.expected_amount), 0))
        .join(Commitment, Commitment.id == BillInstance.commitment_id)
        .where(
            BillInstance.entity_id == entity_id,
            BillInstance.due_date >= start_date,
            BillInstance.due_date <= end_date,
            BillInstance.status.in_(["planned", "due_soon", "needs_review"]),
            Commitment.status == commitment_status,
        )
    )
    return Decimal(total or 0).quantize(Decimal("0.01"))


def latest_transaction_date(session: Session, entity_id: str) -> date | None:
    return session.scalar(
        select(func.max(Transaction.transaction_date)).where(Transaction.entity_id == entity_id)
    )


def flexible_spend_total(
    session: Session,
    entity_id: str,
    start_date: date,
    end_date: date,
) -> Decimal:
    transactions = session.scalars(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.amount < 0,
            Transaction.transaction_type.not_in(
                ["internal_transfer", "internal_transfer_candidate", "family_transfer", "ignored"]
            ),
        )
    ).all()
    total = sum(
        (
            abs(transaction.amount)
            for transaction in transactions
            if normalized_group_for_transaction(transaction) == "flexible"
        ),
        Decimal("0.00"),
    )
    return total.quantize(Decimal("0.01"))


def count_rows(session: Session, model, entity_id: str) -> int:
    return int(
        session.scalar(select(func.count(model.id)).where(model.entity_id == entity_id)) or 0
    )


def format_optional_money(value: Decimal | None) -> str | None:
    return format_money(value) if value is not None else None


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
