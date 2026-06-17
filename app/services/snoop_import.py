from __future__ import annotations

import csv
import hashlib
import io
from collections import Counter, defaultdict
from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal, InvalidOperation

from app.schemas.imports import DetectedAccount, DetectedCategory, SnoopImportPreview

REQUIRED_COLUMNS = {
    "Date",
    "Merchant Name",
    "Description",
    "Amount",
    "Category",
    "Notes",
    "Account Provider",
    "Account Name",
    "Status",
    "Sub Type",
}

IGNORED_ACCOUNT_PROVIDERS = {"monzo"}

CATEGORY_GROUPS = {
    "cash": "flexible",
    "charity": "flexible",
    "eating out": "flexible",
    "entertainment": "flexible",
    "general": "needs_review",
    "groceries": "flexible",
    "health & beauty": "flexible",
    "home & family": "fixed",
    "income": "income",
    "internal transfers": "transfer",
    "shopping": "flexible",
    "transport": "fixed",
    "travel": "non_monthly",
    "finances": "debt",
}


class SnoopImportError(ValueError):
    """Raised when a Snoop CSV cannot be previewed."""


@dataclass(frozen=True)
class ParsedSnoopRow:
    transaction_date: date
    merchant_name: str
    description: str
    amount: Decimal
    category: str
    notes: str
    account_provider: str
    account_name: str
    status: str
    sub_type: str
    fingerprint: str


def preview_snoop_csv(contents: bytes, source_filename: str) -> SnoopImportPreview:
    rows, warnings = parse_snoop_csv(contents)
    fingerprints = [base_transaction_fingerprint(row) for row in rows]
    duplicate_fingerprint_count = sum(
        count - 1 for count in Counter(fingerprints).values() if count > 1
    )

    inflow_total = sum((row.amount for row in rows if row.amount > 0), Decimal("0"))
    outflow_total = sum((row.amount for row in rows if row.amount < 0), Decimal("0"))
    net_total = inflow_total + outflow_total
    dates = [row.transaction_date for row in rows]

    return SnoopImportPreview(
        source_filename=source_filename,
        row_count=len(rows),
        valid_row_count=len(rows),
        invalid_row_count=0,
        duplicate_fingerprint_count=duplicate_fingerprint_count,
        date_start=min(dates).isoformat() if dates else None,
        date_end=max(dates).isoformat() if dates else None,
        pending_count=sum(1 for row in rows if row.status.lower() == "pending"),
        inflow_total=format_money(inflow_total),
        outflow_total=format_money(outflow_total),
        net_total=format_money(net_total),
        accounts=detect_accounts(rows),
        categories=detect_categories(rows),
        warnings=warnings,
    )


def parse_snoop_csv(contents: bytes) -> tuple[list[ParsedSnoopRow], list[str]]:
    text = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise SnoopImportError("CSV file is empty.")

    missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames))
    if missing:
        raise SnoopImportError(f"Snoop CSV is missing required columns: {', '.join(missing)}")

    warnings: list[str] = []
    rows: list[ParsedSnoopRow] = []
    ignored_provider_counts: Counter[str] = Counter()
    for index, row in enumerate(reader, start=2):
        try:
            parsed = parse_row(row)
            if should_ignore_provider(parsed.account_provider):
                ignored_provider_counts[parsed.account_provider] += 1
                continue
            rows.append(parsed)
        except (InvalidOperation, ValueError) as exc:
            warnings.append(f"Row {index} skipped: {exc}")

    for provider, count in sorted(ignored_provider_counts.items()):
        warnings.append(
            f"Ignored {count} {provider} row(s); use the dedicated Monzo import instead."
        )

    if not rows:
        raise SnoopImportError("No valid Snoop transactions found.")

    return assign_occurrence_fingerprints(rows), warnings


def parse_row(row: dict[str, str]) -> ParsedSnoopRow:
    transaction_date = date.fromisoformat(required_value(row, "Date"))
    amount = Decimal(required_value(row, "Amount"))
    merchant_name = clean(row.get("Merchant Name", ""))
    description = clean(row.get("Description", ""))
    account_provider = clean(row.get("Account Provider", ""))
    account_name = clean(row.get("Account Name", ""))
    category = clean(row.get("Category", "")) or "Uncategorized"
    notes = clean(row.get("Notes", ""))
    status = clean(row.get("Status", ""))
    sub_type = clean(row.get("Sub Type", ""))

    if not account_provider:
        raise ValueError("Account Provider is required")
    if not account_name:
        raise ValueError("Account Name is required")

    return ParsedSnoopRow(
        transaction_date=transaction_date,
        merchant_name=merchant_name,
        description=description,
        amount=amount,
        category=category,
        notes=notes,
        account_provider=account_provider,
        account_name=account_name,
        status=status,
        sub_type=sub_type,
        fingerprint=build_fingerprint(
            transaction_date=transaction_date,
            amount=amount,
            account_provider=account_provider,
            account_name=account_name,
            merchant_name=merchant_name,
            description=description,
        ),
    )


def should_ignore_provider(provider: str) -> bool:
    return provider.strip().lower() in IGNORED_ACCOUNT_PROVIDERS


def assign_occurrence_fingerprints(rows: list[ParsedSnoopRow]) -> list[ParsedSnoopRow]:
    """Preserve legitimate repeated Snoop rows while keeping re-imports idempotent."""
    occurrence_counts: Counter[str] = Counter()
    unique_rows: list[ParsedSnoopRow] = []
    for row in rows:
        base_fingerprint = base_transaction_fingerprint(row)
        occurrence_counts[base_fingerprint] += 1
        occurrence = occurrence_counts[base_fingerprint]
        unique_rows.append(
            row
            if occurrence == 1
            else replace(
                row,
                fingerprint=occurrence_fingerprint(base_fingerprint, occurrence),
            )
        )
    return unique_rows


def base_transaction_fingerprint(row: ParsedSnoopRow) -> str:
    return build_fingerprint(
        transaction_date=row.transaction_date,
        amount=row.amount,
        account_provider=row.account_provider,
        account_name=row.account_name,
        merchant_name=row.merchant_name,
        description=row.description,
    )


def occurrence_fingerprint(base_fingerprint: str, occurrence: int) -> str:
    return hashlib.sha256(f"{base_fingerprint}|occurrence:{occurrence}".encode()).hexdigest()


def detect_accounts(rows: list[ParsedSnoopRow]) -> list[DetectedAccount]:
    grouped: dict[tuple[str, str], list[ParsedSnoopRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.account_provider, row.account_name)].append(row)

    accounts = []
    for (provider, name), account_rows in grouped.items():
        inflow_total = sum((row.amount for row in account_rows if row.amount > 0), Decimal("0"))
        outflow_total = sum((row.amount for row in account_rows if row.amount < 0), Decimal("0"))
        accounts.append(
            DetectedAccount(
                provider=provider,
                name=name,
                transaction_count=len(account_rows),
                inflow_total=format_money(inflow_total),
                outflow_total=format_money(outflow_total),
                net_total=format_money(inflow_total + outflow_total),
                suggested_type=suggest_account_type(provider, name),
            )
        )

    return sorted(accounts, key=lambda account: account.transaction_count, reverse=True)


def detect_categories(rows: list[ParsedSnoopRow]) -> list[DetectedCategory]:
    grouped: dict[str, list[ParsedSnoopRow]] = defaultdict(list)
    for row in rows:
        grouped[row.category].append(row)

    categories = []
    for category, category_rows in grouped.items():
        net_total = sum((row.amount for row in category_rows), Decimal("0"))
        categories.append(
            DetectedCategory(
                source_category=category,
                transaction_count=len(category_rows),
                net_total=format_money(net_total),
                normalized_group=CATEGORY_GROUPS.get(category.lower(), "needs_review"),
            )
        )

    return sorted(categories, key=lambda category: category.transaction_count, reverse=True)


def build_fingerprint(
    *,
    transaction_date: date,
    amount: Decimal,
    account_provider: str,
    account_name: str,
    merchant_name: str,
    description: str,
) -> str:
    raw = "|".join(
        [
            transaction_date.isoformat(),
            str(amount.quantize(Decimal("0.01"))),
            account_provider.lower(),
            account_name.lower(),
            merchant_name.lower(),
            description.lower(),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def suggest_account_type(provider: str, name: str) -> str:
    haystack = f"{provider} {name}".lower()
    if "credit card" in haystack or "american express" in haystack or "vanquis" in haystack:
        return "credit_card"
    if "loan" in haystack:
        return "loan"
    if "savings" in haystack or "pot" in haystack:
        return "savings"
    if any(
        token in haystack
        for token in ["barclays personal", "hsbc personal", "monzo", "natwest", "starling"]
    ):
        return "current"
    return "unknown"


def initial_transaction_type(category: str) -> str:
    if category.lower() == "internal transfers":
        return "internal_transfer_candidate"
    if category.lower() == "income":
        return "income"
    if CATEGORY_GROUPS.get(category.lower()) == "debt":
        return "debt_payment"
    return "spending"


def required_value(row: dict[str, str], key: str) -> str:
    value = clean(row.get(key, ""))
    if not value:
        raise ValueError(f"{key} is required")
    return value


def clean(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))
