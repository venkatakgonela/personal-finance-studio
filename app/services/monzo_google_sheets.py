from __future__ import annotations

import hashlib
import re
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Account, ImportLog, IntegrationConnection, Transaction
from app.schemas.google_sheets import (
    GoogleSheetsConfig,
    GoogleSheetsImportResult,
    GoogleSheetsStatus,
)
from app.services.google_sheets_client import GoogleSheetsApiClient, GoogleSheetsApiError
from app.services.import_commit import get_or_create_default_profile, get_or_create_household_entity
from app.services.secret_store import SecretStore
from app.services.snoop_import import clean, initial_transaction_type

PROVIDER = "google_sheets_monzo"
PROVIDER_LABEL = "Monzo Google Sheets"
MONZO_PROVIDER = "Monzo"
DEFAULT_FRONTEND_REDIRECT = "http://127.0.0.1:5175/#/monzo-sheets"
MONZO_FLEX_ACCOUNT_NAME = "Monzo Flex"


class GoogleSheetsIntegrationError(ValueError):
    """Raised when the Monzo Google Sheets connector cannot proceed."""


def get_status(
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: GoogleSheetsApiClient | None = None,
) -> GoogleSheetsStatus:
    store = secret_store or SecretStore.from_settings()
    api_client = client or GoogleSheetsApiClient()
    connection = get_connection(session)
    if connection is None:
        oauth_client_id, oauth_client_secret = google_oauth_credentials(required=False)
        oauth_configured = bool(oauth_client_id and oauth_client_secret)
        return GoogleSheetsStatus(
            configured=False,
            validated=False,
            oauth_configured=oauth_configured,
            status="not_configured",
            message=(
                "Add the Monzo Google Sheet URL and connect with your Google account."
                if oauth_configured
                else "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first."
            ),
            secret_storage=store.description,
        )
    return status_from_connection(connection, store, api_client)


def save_config(
    payload: GoogleSheetsConfig,
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: GoogleSheetsApiClient | None = None,
) -> GoogleSheetsStatus:
    store = secret_store or SecretStore.from_settings()
    api_client = client or GoogleSheetsApiClient()
    oauth_client_id, oauth_client_secret = google_oauth_credentials(required=True)
    spreadsheet_id = extract_spreadsheet_id(str(payload.spreadsheet_url))
    if not spreadsheet_id:
        raise GoogleSheetsIntegrationError("Paste a valid Google Sheets URL.")

    connection = get_connection(session)
    if connection is None:
        connection = IntegrationConnection(
            provider=PROVIDER,
            base_url=str(payload.spreadsheet_url),
            auth_url=api_client.auth_url,
            token_url=api_client.token_url,
        )
        session.add(connection)
        session.flush()

    connection.environment = "production"
    connection.base_url = str(payload.spreadsheet_url)
    connection.auth_url = api_client.auth_url
    connection.token_url = api_client.token_url
    connection.client_id = oauth_client_id
    connection.encrypted_client_secret = store.encrypt(oauth_client_secret)
    connection.company_name = PROVIDER_LABEL
    connection.company_url = spreadsheet_id
    connection.selected_bank_account_name = (
        clean(payload.sheet_name) or "Personal Account Transactions"
    )
    connection.selected_bank_account_url = str(payload.redirect_uri)
    connection.validation_message = (
        "Configured. Connect Google to authorize read-only Sheets access."
    )
    connection.status = "configured"
    session.commit()
    return status_from_connection(connection, store, api_client)


def exchange_authorization_code(
    *,
    code: str,
    state: str,
    session: Session,
    secret_store: SecretStore | None = None,
    client: GoogleSheetsApiClient | None = None,
) -> GoogleSheetsStatus:
    store = secret_store or SecretStore.from_settings()
    api_client = client or GoogleSheetsApiClient()
    connection = require_connection(session)
    if state and state != connection.id:
        raise GoogleSheetsIntegrationError("Google OAuth state did not match this connection.")
    oauth_client_id, oauth_client_secret = google_oauth_credentials(required=False)
    client_id = oauth_client_id or connection.client_id
    client_secret = oauth_client_secret or store.decrypt(connection.encrypted_client_secret)
    try:
        tokens = api_client.exchange_authorization_code(
            client_id=client_id,
            client_secret=client_secret,
            code=code,
            redirect_uri=connection.selected_bank_account_url,
        )
    except GoogleSheetsApiError as exc:
        raise GoogleSheetsIntegrationError(str(exc)) from exc

    access_token = str(tokens.get("access_token") or "")
    refresh_token = str(tokens.get("refresh_token") or "")
    if not access_token:
        raise GoogleSheetsIntegrationError("Google did not return an access token.")
    if not refresh_token:
        raise GoogleSheetsIntegrationError(
            "Google did not return a refresh token. Reconnect with prompt=consent."
        )
    connection.client_id = client_id
    connection.encrypted_client_secret = store.encrypt(client_secret)
    connection.encrypted_access_token = store.encrypt(access_token)
    connection.encrypted_refresh_token = store.encrypt(refresh_token)
    connection.status = "validated"
    connection.validation_message = "Connected to Google Sheets with read-only access."
    connection.last_validated_at = datetime.now(UTC)
    session.commit()
    return status_from_connection(connection, store, api_client)


def validate_connection(
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: GoogleSheetsApiClient | None = None,
) -> GoogleSheetsStatus:
    store = secret_store or SecretStore.from_settings()
    api_client = client or GoogleSheetsApiClient()
    connection = require_connection(session)
    values = read_sheet_values(connection, store, api_client, limit_range=True)
    if len(values) < 2:
        raise GoogleSheetsIntegrationError("Google Sheet connected, but no Monzo rows were found.")
    connection.status = "validated"
    connection.validation_message = f"Connected. Found {len(values) - 1} sample Monzo row(s)."
    connection.last_validated_at = datetime.now(UTC)
    session.commit()
    return status_from_connection(connection, store, api_client)


def import_transactions(
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: GoogleSheetsApiClient | None = None,
) -> GoogleSheetsImportResult:
    store = secret_store or SecretStore.from_settings()
    api_client = client or GoogleSheetsApiClient()
    connection = require_connection(session)
    values = read_sheet_values(connection, store, api_client, limit_range=False)
    rows = parse_monzo_values(values)
    if not rows:
        raise GoogleSheetsIntegrationError("No Monzo transactions found in the configured sheet.")

    entity = get_or_create_household_entity(session)
    profile = get_or_create_default_profile(session, entity)
    source_fingerprint = hashlib.sha256(repr(values).encode()).hexdigest()
    import_log = ImportLog(
        entity_id=entity.id,
        source="monzo_google_sheets",
        source_filename=connection.base_url,
        source_fingerprint=source_fingerprint,
        row_count=len(rows),
        valid_row_count=len(rows),
        duplicate_fingerprint_count=0,
        imported_transaction_count=0,
        skipped_duplicate_count=0,
        date_start=min(row.transaction_date for row in rows),
        date_end=max(row.transaction_date for row in rows),
    )
    session.add(import_log)
    session.flush()

    account_cache: dict[str, Account] = {}
    account_totals: dict[str, Decimal] = {}
    created_account_count = 0
    reused_account_count = 0
    imported_count = 0
    skipped_count = 0
    for row in rows:
        account_name = row.account_name
        account = account_cache.get(account_name)
        if account is None:
            account, created = get_or_create_monzo_account(session, entity.id, profile.id, row)
            account_cache[account_name] = account
            created_account_count += 1 if created else 0
            reused_account_count += 0 if created else 1
        account_totals[account.id] = account_totals.get(account.id, Decimal("0")) + row.amount
        if transaction_exists(session, entity.id, row.fingerprint):
            skipped_count += 1
            continue
        session.add(
            Transaction(
                entity_id=entity.id,
                account_id=account.id,
                import_id=import_log.id,
                transaction_date=row.transaction_date,
                merchant_name=row.name,
                description=row.description,
                amount=row.amount,
                direction="inflow" if row.amount > Decimal("0") else "outflow",
                source_category=row.category,
                status="posted",
                transaction_type=row.transaction_type,
                fingerprint=row.fingerprint,
                notes=row.notes,
                sub_type=row.transaction_type_label,
            )
        )
        imported_count += 1

    for account_id, balance in account_totals.items():
        account = session.get(Account, account_id)
        if account is not None:
            account.current_balance = balance.quantize(Decimal("0.01"))
            account.balance_as_of = import_log.date_end

    backfill_monzo_flex_transactions(
        session,
        entity.id,
        profile.id,
        balance_as_of=import_log.date_end,
    )

    connection.status = "validated"
    connection.last_synced_at = datetime.now(UTC)
    connection.validation_message = f"Imported {imported_count} Monzo row(s)."
    import_log.imported_transaction_count = imported_count
    import_log.skipped_duplicate_count = skipped_count
    session.commit()

    return GoogleSheetsImportResult(
        import_id=import_log.id,
        row_count=len(rows),
        imported_transaction_count=imported_count,
        skipped_duplicate_count=skipped_count,
        created_account_count=created_account_count,
        reused_account_count=reused_account_count,
        date_start=import_log.date_start.isoformat() if import_log.date_start else None,
        date_end=import_log.date_end.isoformat() if import_log.date_end else None,
        warnings=[],
    )


def read_sheet_values(
    connection: IntegrationConnection,
    store: SecretStore,
    client: GoogleSheetsApiClient,
    *,
    limit_range: bool,
) -> list[list[Any]]:
    access_token = ensure_access_token(connection, store, client)
    sheet_name = connection.selected_bank_account_name or "Personal Account Transactions"
    value_range = f"'{sheet_name}'!A1:Q25" if limit_range else f"'{sheet_name}'!A:Q"
    try:
        return client.get_values(
            access_token=access_token,
            spreadsheet_id=connection.company_url,
            value_range=value_range,
        )
    except GoogleSheetsApiError as exc:
        raise GoogleSheetsIntegrationError(str(exc)) from exc


def ensure_access_token(
    connection: IntegrationConnection,
    store: SecretStore,
    client: GoogleSheetsApiClient,
) -> str:
    access_token = store.decrypt(connection.encrypted_access_token)
    refresh_token = store.decrypt(connection.encrypted_refresh_token)
    if access_token:
        return access_token
    if not refresh_token:
        raise GoogleSheetsIntegrationError("Connect Google before reading the Monzo sheet.")
    oauth_client_id, oauth_client_secret = google_oauth_credentials(required=False)
    client_id = oauth_client_id or connection.client_id
    client_secret = oauth_client_secret or store.decrypt(connection.encrypted_client_secret)
    try:
        tokens = client.refresh_access_token(
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token,
        )
    except GoogleSheetsApiError as exc:
        raise GoogleSheetsIntegrationError(str(exc)) from exc
    next_access_token = str(tokens.get("access_token") or "")
    if not next_access_token:
        raise GoogleSheetsIntegrationError("Google did not return a refreshed access token.")
    connection.encrypted_access_token = store.encrypt(next_access_token)
    return next_access_token


def status_from_connection(
    connection: IntegrationConnection,
    store: SecretStore,
    client: GoogleSheetsApiClient,
) -> GoogleSheetsStatus:
    oauth_client_id, oauth_client_secret = google_oauth_credentials(required=False)
    if oauth_client_id and oauth_client_secret:
        connection.client_id = oauth_client_id
        if not connection.encrypted_client_secret:
            connection.encrypted_client_secret = store.encrypt(oauth_client_secret)
    configured = bool(connection.client_id and connection.encrypted_client_secret)
    validated = connection.status == "validated" and bool(connection.encrypted_refresh_token)
    return GoogleSheetsStatus(
        configured=configured,
        validated=validated,
        oauth_configured=bool(oauth_client_id and oauth_client_secret),
        status=connection.status,
        message=connection.validation_message or "Configured.",
        client_id_last4=connection.client_id[-4:] if connection.client_id else None,
        spreadsheet_id=connection.company_url or None,
        spreadsheet_url=connection.base_url or None,
        sheet_name=connection.selected_bank_account_name or None,
        auth_url=(
            client.build_authorization_url(
                client_id=connection.client_id,
                redirect_uri=connection.selected_bank_account_url,
                state=connection.id,
            )
            if configured and connection.selected_bank_account_url
            else None
        ),
        last_validated_at=(
            connection.last_validated_at.isoformat() if connection.last_validated_at else None
        ),
        last_synced_at=connection.last_synced_at.isoformat() if connection.last_synced_at else None,
        secret_storage=store.description,
    )


def google_oauth_credentials(*, required: bool) -> tuple[str, str]:
    settings = get_settings()
    client_id = clean(settings.google_oauth_client_id or "")
    client_secret = clean(settings.google_oauth_client_secret or "")
    if required and (not client_id or not client_secret):
        raise GoogleSheetsIntegrationError(
            "Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env, "
            "then restart the backend."
        )
    return client_id, client_secret


def parse_monzo_values(values: list[list[Any]]) -> list[MonzoSheetRow]:
    if not values:
        return []
    headers = [clean(str(value)) for value in values[0]]
    required = {"Transaction ID", "Date", "Name", "Category", "Amount", "Description", "Pot name"}
    missing = sorted(required - set(headers))
    if missing:
        raise GoogleSheetsIntegrationError(f"Monzo sheet is missing columns: {', '.join(missing)}")
    rows: list[MonzoSheetRow] = []
    for value_row in values[1:]:
        row = {
            header: value_row[index] if index < len(value_row) else ""
            for index, header in enumerate(headers)
        }
        if not clean(str(row.get("Transaction ID") or "")):
            continue
        rows.append(parse_monzo_row(row))
    return rows


class MonzoSheetRow:
    def __init__(
        self,
        *,
        transaction_id: str,
        transaction_date: date,
        transaction_type_label: str,
        name: str,
        category: str,
        amount: Decimal,
        notes: str,
        description: str,
        pot_name: str,
    ) -> None:
        self.transaction_id = transaction_id
        self.transaction_date = transaction_date
        self.transaction_type_label = transaction_type_label
        self.name = name
        self.category = category
        self.amount = amount
        self.notes = notes
        self.description = description
        self.pot_name = pot_name
        self.is_flex = is_monzo_flex_row(
            category=category,
            description=description,
            name=name,
            transaction_type_label=transaction_type_label,
        )
        self.account_name = monzo_account_name(pot_name)
        self.account_type = monzo_account_type(pot_name)
        self.fingerprint = hashlib.sha256(
            f"monzo_google_sheets|{transaction_id}".encode()
        ).hexdigest()
        if self.is_flex:
            self.category = "Monzo Flex"
            self.transaction_type = "debt_payment"
        else:
            normalized_category = "Internal Transfers" if category == "Transfers" else category
            self.transaction_type = initial_transaction_type(normalized_category)


def parse_monzo_row(row: dict[str, Any]) -> MonzoSheetRow:
    amount = parse_decimal(row.get("Amount"))
    category = clean(str(row.get("Category") or "Uncategorized")) or "Uncategorized"
    return MonzoSheetRow(
        transaction_id=clean(str(row.get("Transaction ID") or "")),
        transaction_date=parse_sheet_date(row.get("Date")),
        transaction_type_label=clean(str(row.get("Type") or "")),
        name=clean(str(row.get("Name") or "")),
        category=category,
        amount=amount,
        notes=clean(str(row.get("Notes and #tags") or "")),
        description=clean(str(row.get("Description") or "")),
        pot_name=clean(str(row.get("Pot name") or "")),
    )


def get_or_create_monzo_account(
    session: Session,
    entity_id: str,
    profile_id: str | None,
    row: MonzoSheetRow,
) -> tuple[Account, bool]:
    account = session.scalar(
        select(Account).where(
            Account.entity_id == entity_id,
            Account.provider == MONZO_PROVIDER,
            Account.source_account_name == row.account_name,
        )
    )
    if account is not None:
        account.account_type = row.account_type
        if row.account_type in {"bnpl", "credit_card", "loan"}:
            account.include_in_cash_on_hand = False
            account.include_in_forecast = False
        return account, False
    account = Account(
        entity_id=entity_id,
        profile_id=profile_id,
        provider=MONZO_PROVIDER,
        display_name=row.account_name,
        source_account_name=row.account_name,
        account_type=row.account_type,
        include_in_cash_on_hand=row.account_type not in {"bnpl", "credit_card", "loan"},
        include_in_forecast=row.account_type not in {"bnpl", "credit_card", "loan"},
    )
    session.add(account)
    session.flush()
    return account, True


def monzo_account_name(pot_name: str) -> str:
    return "Monzo Current" if not pot_name else f"Monzo Pot: {pot_name}"


def monzo_account_type(pot_name: str) -> str:
    return "current" if not pot_name else "pot"


def is_monzo_flex_row(
    *,
    category: str,
    description: str,
    name: str,
    transaction_type_label: str,
) -> bool:
    haystack = " ".join([category, description, name, transaction_type_label]).lower()
    return bool(re.search(r"\bflex\b", haystack))


def backfill_monzo_flex_transactions(
    session: Session,
    entity_id: str,
    profile_id: str | None,
    *,
    balance_as_of: date | None,
) -> None:
    flex_account = get_or_create_virtual_monzo_flex_account(session, entity_id, profile_id)
    current_account = get_or_create_monzo_current_account(session, entity_id, profile_id)
    flex_rows = session.scalars(
        select(Transaction).join(Account).where(
            Transaction.entity_id == entity_id,
            Account.provider == MONZO_PROVIDER,
            Transaction.description.ilike("%flex%"),
        )
    ).all()
    if not flex_rows:
        return
    for transaction in flex_rows:
        transaction.account_id = current_account.id
        transaction.source_category = "Monzo Flex"
        transaction.transaction_type = "debt_payment"
    session.flush()
    current_balance = session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.entity_id == entity_id,
            Transaction.account_id == current_account.id,
        )
    )
    current_account.current_balance = Decimal(current_balance or 0).quantize(Decimal("0.01"))
    current_account.balance_as_of = balance_as_of
    flex_account.current_balance = None
    flex_account.balance_as_of = None


def get_or_create_virtual_monzo_flex_account(
    session: Session,
    entity_id: str,
    profile_id: str | None,
) -> Account:
    account = session.scalar(
        select(Account).where(
            Account.entity_id == entity_id,
            Account.provider == MONZO_PROVIDER,
            Account.source_account_name == MONZO_FLEX_ACCOUNT_NAME,
        )
    )
    if account is not None:
        account.account_type = "bnpl"
        account.include_in_cash_on_hand = False
        account.include_in_forecast = False
        return account
    account = Account(
        entity_id=entity_id,
        profile_id=profile_id,
        provider=MONZO_PROVIDER,
        display_name=MONZO_FLEX_ACCOUNT_NAME,
        source_account_name=MONZO_FLEX_ACCOUNT_NAME,
        account_type="bnpl",
        include_in_cash_on_hand=False,
        include_in_forecast=False,
    )
    session.add(account)
    session.flush()
    return account


def get_or_create_monzo_current_account(
    session: Session,
    entity_id: str,
    profile_id: str | None,
) -> Account:
    account = session.scalar(
        select(Account).where(
            Account.entity_id == entity_id,
            Account.provider == MONZO_PROVIDER,
            Account.source_account_name == "Monzo Current",
        )
    )
    if account is not None:
        return account
    account = Account(
        entity_id=entity_id,
        profile_id=profile_id,
        provider=MONZO_PROVIDER,
        display_name="Monzo Current",
        source_account_name="Monzo Current",
        account_type="current",
        include_in_cash_on_hand=True,
        include_in_forecast=True,
    )
    session.add(account)
    session.flush()
    return account


def transaction_exists(session: Session, entity_id: str, fingerprint: str) -> bool:
    return (
        session.scalar(
            select(Transaction.id).where(
                Transaction.entity_id == entity_id,
                Transaction.fingerprint == fingerprint,
            )
        )
        is not None
    )


def parse_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"))
    except InvalidOperation as exc:
        raise GoogleSheetsIntegrationError(f"Invalid Monzo amount: {value}") from exc


def parse_sheet_date(value: Any) -> date:
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return date.fromisoformat(value)
    try:
        serial = float(value)
    except (TypeError, ValueError) as exc:
        raise GoogleSheetsIntegrationError(f"Invalid Monzo date: {value}") from exc
    return (datetime(1899, 12, 30) + timedelta(days=serial)).date()


def extract_spreadsheet_id(url: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    return match.group(1) if match else ""


def get_connection(session: Session) -> IntegrationConnection | None:
    return session.scalar(
        select(IntegrationConnection).where(IntegrationConnection.provider == PROVIDER)
    )


def require_connection(session: Session) -> IntegrationConnection:
    connection = get_connection(session)
    if connection is None:
        raise GoogleSheetsIntegrationError("Configure Monzo Google Sheets first.")
    return connection
