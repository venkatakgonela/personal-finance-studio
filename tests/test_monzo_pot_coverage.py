from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Account, Commitment, Entity
from app.services.planning import get_planning_overview


def test_monzo_pot_coverage_respects_individual_pot_shortfalls(
    db_session: Session,
) -> None:
    entity = Entity(name="Household", type="household")
    db_session.add(entity)
    db_session.flush()
    db_session.add_all(
        [
            Account(
                entity_id=entity.id,
                provider="Monzo",
                display_name="Monzo Pot: Credit Cards",
                source_account_name="Monzo Pot: Credit Cards",
                account_type="pot",
                current_balance=Decimal("50.00"),
            ),
            Account(
                entity_id=entity.id,
                provider="Monzo",
                display_name="Monzo Pot: Salary",
                source_account_name="Monzo Pot: Salary",
                account_type="pot",
                current_balance=Decimal("1000.00"),
            ),
            Commitment(
                entity_id=entity.id,
                name="Aqua Card",
                source_label="Aqua Card",
                commitment_type="credit_card_payment",
                category="Credit cards",
                frequency="monthly",
                expected_amount=Decimal("120.00"),
                next_due_date=date(2026, 6, 19),
                source="manual",
                source_key="manual:aqua",
                status="confirmed",
            ),
        ]
    )
    db_session.commit()

    overview = get_planning_overview(
        db_session,
        entity.id,
        today=date(2026, 6, 17),
        pot_coverage_start=date(2026, 6, 17),
        pot_coverage_days=14,
    )

    credit_cards = next(item for item in overview.pot_coverage if item.pot_name == "Credit Cards")
    salary = next(item for item in overview.pot_coverage if item.pot_name == "Salary")

    assert credit_cards.status == "short"
    assert credit_cards.current_balance == "50.00"
    assert credit_cards.required_amount == "120.00"
    assert credit_cards.surplus_or_shortfall == "-70.00"
    assert credit_cards.items[0].name == "Aqua Card"
    assert salary.status == "no_planned_bills"
    assert salary.surplus_or_shortfall == "1000.00"
