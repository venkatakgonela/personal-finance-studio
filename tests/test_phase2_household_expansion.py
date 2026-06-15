from decimal import Decimal

from app.services.categories import normalized_group


def test_phase2_rule_group_labels_normalize_to_expected_budget_groups() -> None:
    assert (
        normalized_group(
            amount=Decimal("-25.00"),
            description="Rule applied",
            merchant_name="Example",
            source_category="Flexible",
            transaction_type="spending",
        )
        == "flexible"
    )
    assert (
        normalized_group(
            amount=Decimal("-100.00"),
            description="Rule applied",
            merchant_name="Example",
            source_category="Debt",
            transaction_type="debt_payment",
        )
        == "debt"
    )
    assert (
        normalized_group(
            amount=Decimal("-80.00"),
            description="Rule applied",
            merchant_name="Example",
            source_category="Non Monthly",
            transaction_type="spending",
        )
        == "non_monthly"
    )
