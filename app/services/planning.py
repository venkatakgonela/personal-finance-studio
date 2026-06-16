from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, BillInstance, Commitment, Entity, ImportLog, Transaction
from app.schemas.planning import (
    ImportFreshness,
    MonthlyReviewGroupSummary,
    MonthlyReviewSummary,
    PlanningGoal,
    PlanningOverview,
    SavedReportFilter,
    SinkingFundPlan,
    StaleCommitmentReview,
    SubscriptionReviewItem,
)
from app.services.account_balances import available_for_bills
from app.services.categories import normalized_group_for_transaction
from app.services.dashboard import latest_transaction_date
from app.services.decisions import count_decisions

SUBSCRIPTION_TOKENS = {
    "membership",
    "netflix",
    "prime",
    "spotify",
    "subscription",
    "youtube",
}


def get_planning_overview(
    session: Session,
    entity_id: str,
    *,
    today: date | None = None,
) -> PlanningOverview:
    entity = session.get(Entity, entity_id)
    if entity is None:
        raise ValueError("Entity not found.")

    today = today or latest_transaction_date(session, entity_id) or date.today()
    month_start = today.replace(day=1)
    transactions = list_transactions(session, entity_id, month_start, today)
    commitments = session.scalars(
        select(Commitment)
        .where(Commitment.entity_id == entity_id, Commitment.status != "rejected")
        .order_by(Commitment.next_due_date.asc().nulls_last(), Commitment.name.asc())
    ).all()
    decision_count = count_decisions(session, entity_id)
    review = monthly_review(transactions, month_start, today, decision_count)

    return PlanningOverview(
        entity_id=entity.id,
        entity_name=entity.name,
        goals=planning_goals(session, entity_id, commitments, review),
        sinking_funds=sinking_funds(commitments),
        monthly_review=review,
        subscriptions=subscription_reviews(commitments),
        saved_filters=saved_filters(),
        import_freshness=import_freshness(session, entity_id, today),
        stale_commitments=stale_commitments(session, commitments, today),
    )


def list_transactions(
    session: Session,
    entity_id: str,
    start_date: date,
    end_date: date,
) -> list[Transaction]:
    return session.scalars(
        select(Transaction).where(
            Transaction.entity_id == entity_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
        )
    ).all()


def monthly_review(
    transactions: list[Transaction],
    start_date: date,
    end_date: date,
    decision_count: int,
) -> MonthlyReviewSummary:
    review_transactions = [
        tx
        for tx in transactions
        if normalized_group_for_transaction(tx) not in {"ignored", "transfer"}
    ]
    income_total = sum(
        (
            tx.amount
            for tx in review_transactions
            if tx.amount > 0 and normalized_group_for_transaction(tx) == "income"
        ),
        Decimal("0.00"),
    )
    outflow_total = sum(
        (
            abs(tx.amount)
            for tx in review_transactions
            if tx.amount < 0
        ),
        Decimal("0.00"),
    )
    reviewed_count = sum(1 for tx in review_transactions if tx.reviewed)
    unreviewed_count = len(review_transactions) - reviewed_count
    net_total = income_total - outflow_total
    groups = monthly_review_groups(review_transactions)
    next_actions: list[str] = []

    if unreviewed_count:
        next_actions.append(f"Review {unreviewed_count} unreviewed transactions.")
    if decision_count:
        next_actions.append(f"Resolve {decision_count} open finance decisions.")
    if net_total < 0:
        next_actions.append("Outflows exceed income in this period; check flexible spending.")
    if not next_actions:
        next_actions.append("Month is review-ready; save the report snapshot.")

    headline = (
        "Month is in surplus"
        if net_total >= 0
        else "Month needs attention"
    )
    return MonthlyReviewSummary(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        income_total=format_money(income_total),
        outflow_total=format_money(outflow_total),
        net_total=format_money(net_total),
        reviewed_count=reviewed_count,
        unreviewed_count=unreviewed_count,
        decision_count=decision_count,
        headline=headline,
        next_actions=next_actions,
        groups=groups,
    )


def monthly_review_groups(transactions: list[Transaction]) -> list[MonthlyReviewGroupSummary]:
    groups: dict[str, list[Transaction]] = {}
    for transaction in transactions:
        group = normalized_group_for_transaction(transaction)
        groups.setdefault(group, []).append(transaction)

    summaries = []
    for group, rows in groups.items():
        total = sum(
            (
                abs(row.amount)
                if row.amount < 0
                else row.amount
                for row in rows
            ),
            Decimal("0.00"),
        )
        summaries.append(
            MonthlyReviewGroupSummary(
                group=group,
                total=format_money(total),
                transaction_count=len(rows),
                reviewed_count=sum(1 for row in rows if row.reviewed),
                unreviewed_count=sum(1 for row in rows if not row.reviewed),
            )
        )

    order = {"income": 0, "fixed": 1, "debt": 2, "non_monthly": 3, "flexible": 4}
    return sorted(
        summaries,
        key=lambda summary: (order.get(summary.group, 99), summary.group),
    )


def planning_goals(
    session: Session,
    entity_id: str,
    commitments: list[Commitment],
    review: MonthlyReviewSummary,
) -> list[PlanningGoal]:
    cash_on_hand = known_cash_on_hand(session, entity_id)
    has_planning_evidence = bool(commitments) or cash_on_hand > 0 or (
        Decimal(review.income_total) != Decimal("0.00")
        or Decimal(review.outflow_total) != Decimal("0.00")
        or review.reviewed_count > 0
        or review.unreviewed_count > 0
    )
    if not has_planning_evidence:
        return []

    fixed_monthly = sum(
        (
            monthly_equivalent(commitment)
            for commitment in commitments
            if commitment.status == "confirmed"
        ),
        Decimal("0.00"),
    )
    emergency_target = max(Decimal("1000.00"), fixed_monthly * Decimal("3"))
    review_target = max(Decimal("1.00"), Decimal(review.reviewed_count + review.unreviewed_count))
    reviewed_current = Decimal(review.reviewed_count)

    return [
        PlanningGoal(
            id="emergency-buffer",
            name="Emergency buffer",
            target_amount=format_money(emergency_target),
            current_amount=format_money(cash_on_hand),
            monthly_contribution=format_money(
                monthly_gap(cash_on_hand, emergency_target, months=12)
            ),
            progress_percent=progress_percent(cash_on_hand, emergency_target),
            status="on_track" if cash_on_hand >= emergency_target else "needs_funding",
            next_action="Keep three months of confirmed bills available before trusting surplus.",
        ),
        PlanningGoal(
            id="monthly-review-coverage",
            name="Monthly review coverage",
            target_amount=format_money(review_target),
            current_amount=format_money(reviewed_current),
            monthly_contribution="0.00",
            progress_percent=progress_percent(reviewed_current, review_target),
            status="ready" if review.unreviewed_count == 0 else "needs_review",
            next_action="Clear unreviewed transactions so reports are decision-grade.",
        ),
    ]


def known_cash_on_hand(session: Session, entity_id: str) -> Decimal:
    accounts = session.scalars(
        select(Account).where(
            Account.entity_id == entity_id,
            Account.status == "active",
            Account.include_in_cash_on_hand.is_(True),
            Account.current_balance.is_not(None),
            Account.account_type.not_in(["credit_card", "loan", "bnpl"]),
        )
    ).all()
    return sum(
        (available_for_bills(account) or Decimal("0.00") for account in accounts),
        Decimal("0.00"),
    )


def sinking_funds(commitments: list[Commitment]) -> list[SinkingFundPlan]:
    funds = [
        SinkingFundPlan(
            id=f"sinking-{commitment.id}",
            name=commitment.name,
            due_date=commitment.next_due_date.isoformat() if commitment.next_due_date else None,
            frequency=commitment.frequency,
            target_amount=format_money(commitment.expected_amount),
            monthly_set_aside=format_money(monthly_equivalent(commitment)),
            status=commitment.status,
            source_commitment_id=commitment.id,
        )
        for commitment in commitments
        if commitment.frequency in {"annual", "quarterly", "custom"}
        or commitment.commitment_type == "non_monthly"
    ]
    return sorted(funds, key=lambda fund: (fund.due_date or "9999-12-31", fund.name))[:12]


def subscription_reviews(commitments: list[Commitment]) -> list[SubscriptionReviewItem]:
    items: list[SubscriptionReviewItem] = []
    for commitment in commitments:
        name = commitment.name.lower()
        is_subscription = commitment.commitment_type == "subscription" or any(
            token in name for token in SUBSCRIPTION_TOKENS
        )
        if not is_subscription:
            continue
        prompt = (
            "Candidate subscription: confirm or reject before it affects planning."
            if commitment.status == "candidate"
            else "Check whether this still earns its place before the next renewal."
        )
        if commitment.expected_amount >= Decimal("50.00"):
            prompt = "High-value recurring charge: renegotiate, cancel, or keep intentionally."
        items.append(
            SubscriptionReviewItem(
                id=commitment.id,
                name=commitment.name,
                expected_amount=format_money(commitment.expected_amount),
                frequency=commitment.frequency,
                next_due_date=commitment.next_due_date.isoformat()
                if commitment.next_due_date
                else None,
                status=commitment.status,
                prompt=prompt,
                action="Review in recurring",
            )
        )
    return sorted(items, key=lambda item: (item.next_due_date or "9999-12-31", item.name))[:12]


def saved_filters() -> list[SavedReportFilter]:
    return [
        SavedReportFilter(
            id="this-month-flexible",
            label="Inspect flexible spend evidence",
            description=(
                "Opens Transactions filtered to day-to-day spending evidence for this month."
            ),
            route="transactions",
            query="range=this-month&group=flexible&type=spending",
        ),
        SavedReportFilter(
            id="unreviewed",
            label="Inspect open review queue",
            description="Opens Transactions filtered to rows still needing categorisation.",
            route="transactions",
            query="reviewed=unreviewed",
        ),
        SavedReportFilter(
            id="income-vs-outflow",
            label="Return to review summary",
            description="Keeps you on Monthly Review with income, outflows, and open actions.",
            route="monthly-review",
            query="range=this-month",
        ),
        SavedReportFilter(
            id="subscriptions",
            label="Open subscription review",
            description="Opens Subscriptions for recurring service and timing checks.",
            route="subscriptions",
            query="",
        ),
    ]


def import_freshness(session: Session, entity_id: str, today: date) -> ImportFreshness:
    latest_import = session.scalar(
        select(ImportLog)
        .where(ImportLog.entity_id == entity_id)
        .order_by(ImportLog.created_at.desc())
        .limit(1)
    )
    latest_tx_date = latest_transaction_date(session, entity_id)
    if latest_tx_date is None:
        return ImportFreshness(
            status="no_data",
            message="No imported transactions yet.",
            latest_import_date=(
                latest_import.created_at.date().isoformat() if latest_import else None
            ),
            latest_transaction_date=None,
            days_since_latest_transaction=None,
        )
    days_since = max(0, (today - latest_tx_date).days)
    status = "fresh" if days_since <= 14 else "stale" if days_since > 45 else "aging"
    return ImportFreshness(
        status=status,
        message=(
            "Imports are fresh."
            if status == "fresh"
            else "Import data is aging; refresh before making planning decisions."
        ),
        latest_import_date=latest_import.created_at.date().isoformat() if latest_import else None,
        latest_transaction_date=latest_tx_date.isoformat(),
        days_since_latest_transaction=days_since,
    )


def stale_commitments(
    session: Session,
    commitments: list[Commitment],
    today: date,
) -> list[StaleCommitmentReview]:
    stale = []
    for commitment in commitments:
        if commitment.next_due_date is None or commitment.next_due_date >= today:
            continue
        open_due_instance = session.scalar(
            select(BillInstance).where(
                BillInstance.commitment_id == commitment.id,
                BillInstance.due_date == commitment.next_due_date,
                BillInstance.status.in_(["planned", "due_soon", "needs_review"]),
            )
        )
        if open_due_instance is None:
            continue
        stale.append(
            StaleCommitmentReview(
                id=commitment.id,
                name=commitment.name,
                expected_amount=format_money(commitment.expected_amount),
                next_due_date=commitment.next_due_date.isoformat(),
                status=commitment.status,
                reason="Next due date has passed; refresh, mark paid, or reject.",
            )
        )
    return sorted(stale, key=lambda item: item.next_due_date or "9999-12-31")[:10]


def monthly_equivalent(commitment: Commitment) -> Decimal:
    amount = Decimal(commitment.expected_amount)
    if commitment.frequency == "annual":
        return amount / Decimal("12")
    if commitment.frequency == "quarterly":
        return amount / Decimal("3")
    if commitment.frequency == "weekly":
        return amount * Decimal("52") / Decimal("12")
    if commitment.frequency == "fortnightly":
        return amount * Decimal("26") / Decimal("12")
    return amount


def monthly_gap(current: Decimal, target: Decimal, *, months: int) -> Decimal:
    if current >= target:
        return Decimal("0.00")
    return (target - current) / Decimal(months)


def progress_percent(current: Decimal, target: Decimal) -> int:
    if target <= 0:
        return 100
    return min(100, int((current / target * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)))


def format_money(value: Decimal) -> str:
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
