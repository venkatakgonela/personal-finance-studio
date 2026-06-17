from pathlib import Path

import pytest

from app.services.snoop_import import SnoopImportError, parse_snoop_csv, preview_snoop_csv

FIXTURES = Path(__file__).parent / "fixtures"


def test_preview_snoop_csv_summarizes_real_shaped_export() -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    preview = preview_snoop_csv(contents, source_filename="snoop_minimal.csv")

    assert preview.row_count == 5
    assert preview.valid_row_count == 5
    assert preview.date_start == "2026-06-09"
    assert preview.date_end == "2026-06-14"
    assert preview.pending_count == 1
    assert preview.inflow_total == "3590.00"
    assert preview.outflow_total == "-388.99"
    assert preview.net_total == "3201.01"
    assert preview.duplicate_fingerprint_count == 0


def test_preview_detects_accounts_and_suggested_credit_card_type() -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    preview = preview_snoop_csv(contents, source_filename="snoop_minimal.csv")

    accounts = {(account.provider, account.name): account for account in preview.accounts}
    assert accounts[("HSBC Personal", "Household Current")].transaction_count == 4
    assert accounts[("Barclays Personal Banking", "Household Savings")].transaction_count == 1


def test_preview_normalizes_snoop_categories_into_planning_groups() -> None:
    contents = (FIXTURES / "snoop_minimal.csv").read_bytes()

    preview = preview_snoop_csv(contents, source_filename="snoop_minimal.csv")

    groups = {
        category.source_category: category.normalized_group for category in preview.categories
    }
    assert groups["Groceries"] == "flexible"
    assert groups["Internal Transfers"] == "transfer"
    assert groups["Finances"] == "debt"
    assert groups["Income"] == "income"


def test_parse_snoop_csv_rejects_missing_required_columns() -> None:
    contents = b"Date,Amount\n2026-06-14,-10\n"

    with pytest.raises(SnoopImportError, match="missing required columns"):
        parse_snoop_csv(contents)


def test_snoop_import_ignores_monzo_rows_for_dedicated_import() -> None:
    original = (FIXTURES / "snoop_minimal.csv").read_text()
    monzo_row = (
        "2026-06-15,Monzo Merchant,Monzo only,-10.00,General,,Monzo,"
        "Personal,,\n"
    )

    mixed_csv = f"{original.strip()}\n{monzo_row}".encode()

    rows, warnings = parse_snoop_csv(mixed_csv)
    preview = preview_snoop_csv(
        mixed_csv,
        source_filename="mixed.csv",
    )

    assert len(rows) == 5
    assert preview.row_count == 5
    assert all(row.account_provider != "Monzo" for row in rows)
    assert warnings == ["Ignored 1 Monzo row(s); use the dedicated Monzo import instead."]
    assert preview.warnings == warnings


def test_repeated_snoop_rows_are_reported_but_kept_importable() -> None:
    original = (FIXTURES / "snoop_minimal.csv").read_text()
    duplicate_first_transaction = "\n".join([original.strip(), original.splitlines()[1]]) + "\n"

    rows, _warnings = parse_snoop_csv(duplicate_first_transaction.encode("utf-8"))
    preview = preview_snoop_csv(
        duplicate_first_transaction.encode("utf-8"),
        source_filename="duplicate.csv",
    )

    assert preview.row_count == 6
    assert preview.duplicate_fingerprint_count == 1
    assert len({row.fingerprint for row in rows}) == 6
