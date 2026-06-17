from __future__ import annotations

import hashlib
from collections.abc import Callable
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, ImportLog, IntegrationAccount, IntegrationConnection, Transaction
from app.models.base import utc_now
from app.schemas.freeagent import (
    FreeAgentAccountManagementRequest,
    FreeAgentBankAccount,
    FreeAgentConnectionStatus,
    FreeAgentCredentials,
    FreeAgentImportRequest,
    FreeAgentImportResult,
    FreeAgentOAuthExchangeRequest,
    FreeAgentSyncAllRequest,
    FreeAgentSyncAllResult,
    FreeAgentValidationResult,
)
from app.services.freeagent_client import FreeAgentApiClient, FreeAgentApiError
from app.services.import_commit import (
    get_or_create_default_profile,
    get_or_create_household_entity,
    transaction_exists,
)
from app.services.secret_store import SecretStore
from app.services.snoop_import import clean, format_money, initial_transaction_type

PROVIDER = "freeagent"
PROVIDER_LABEL = "FreeAgent"
PRODUCTION_BASE_URL = "https://api.freeagent.com"
SANDBOX_BASE_URL = "https://api.sandbox.freeagent.com"
DAILY_SYNC_HOUR = 6
DAILY_SYNC_INTERVAL_MINUTES = 1440

FreeAgentClientFactory = Callable[[str, str], FreeAgentApiClient]


class FreeAgentIntegrationError(ValueError):
    """Raised when the FreeAgent integration cannot proceed safely."""


def get_status(
    session: Session,
    secret_store: SecretStore | None = None,
) -> FreeAgentConnectionStatus:
    connection = get_connection(session)
    store = secret_store or SecretStore.from_settings()
    if connection is None:
        return FreeAgentConnectionStatus(
            configured=False,
            validated=False,
            status="not_configured",
            message="Add OAuth details and a token to connect FreeAgent.",
            secret_storage=store.description,
        )
    return serialize_status(connection, store)


def save_credentials(
    payload: FreeAgentCredentials,
    session: Session,
    secret_store: SecretStore | None = None,
) -> FreeAgentConnectionStatus:
    store = secret_store or SecretStore.from_settings()
    urls = resolve_urls(payload)
    client_id = payload.client_id.strip()
    client_secret = normalize_secret(payload.client_secret)
    access_token = normalize_oauth_token(payload.access_token)
    refresh_token = normalize_oauth_token(payload.refresh_token)
    if not client_id:
        raise FreeAgentIntegrationError("FreeAgent OAuth client ID is required.")
    if not client_secret:
        raise FreeAgentIntegrationError("FreeAgent OAuth client secret is required.")
    if not access_token:
        raise FreeAgentIntegrationError("Paste a valid FreeAgent access token before validating.")

    connection = get_connection(session)
    if connection is None:
        connection = IntegrationConnection(provider=PROVIDER)
        session.add(connection)

    connection.environment = payload.environment
    connection.base_url = urls["base_url"]
    connection.auth_url = urls["auth_url"]
    connection.token_url = urls["token_url"]
    connection.client_id = client_id
    connection.encrypted_client_secret = store.encrypt(client_secret)
    connection.encrypted_access_token = store.encrypt(access_token)
    connection.encrypted_refresh_token = store.encrypt(refresh_token)
    connection.status = "configured"
    connection.validation_message = "Credentials saved locally. Run validation before importing."
    connection.updated_at = utc_now()
    session.commit()
    return serialize_status(connection, store)


def validate_connection(
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> FreeAgentValidationResult:
    store = secret_store or SecretStore.from_settings()
    connection = require_connection(session)
    client = client_factory(connection.base_url, connection.token_url)
    try:
        company, accounts = call_with_token(
            connection,
            store,
            client,
            lambda access_token: (
                client.get_company(access_token),
                client.get_bank_accounts(access_token),
            ),
        )
    except FreeAgentApiError as exc:
        connection.status = "validation_failed"
        connection.validation_message = str(exc)
        session.commit()
        raise FreeAgentIntegrationError(str(exc)) from exc

    connection.status = "validated"
    connection.validation_message = f"Connected to {company.get('name') or 'FreeAgent'}."
    connection.company_name = clean(str(company.get("name") or ""))
    connection.company_url = clean(str(company.get("url") or ""))
    connection.last_validated_at = utc_now()
    session.commit()
    sync_remote_accounts(session, connection, accounts)
    return FreeAgentValidationResult(
        status=serialize_status(connection, store),
        accounts=serialize_bank_accounts(accounts, session, connection),
    )


def exchange_authorization_code(
    payload: FreeAgentOAuthExchangeRequest,
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> FreeAgentConnectionStatus:
    store = secret_store or SecretStore.from_settings()
    urls = resolve_urls(payload)
    client_id = payload.client_id.strip()
    client_secret = normalize_secret(payload.client_secret)
    authorization_code = normalize_secret(payload.authorization_code)
    if not client_id:
        raise FreeAgentIntegrationError("FreeAgent OAuth client ID is required.")
    if not client_secret:
        raise FreeAgentIntegrationError("FreeAgent OAuth client secret is required.")
    if not authorization_code:
        raise FreeAgentIntegrationError("Paste the authorization code returned by FreeAgent.")

    client = client_factory(urls["base_url"], urls["token_url"])
    try:
        tokens = client.exchange_authorization_code(
            client_id=client_id,
            client_secret=client_secret,
            code=authorization_code,
            redirect_uri=str(payload.redirect_uri),
        )
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc

    access_token = normalize_oauth_token(str(tokens.get("access_token") or ""))
    refresh_token = normalize_oauth_token(str(tokens.get("refresh_token") or ""))
    if not access_token:
        raise FreeAgentIntegrationError("FreeAgent did not return an access token.")
    if not refresh_token:
        raise FreeAgentIntegrationError(
            "FreeAgent did not return a refresh token. Re-authorize the app and make sure "
            "the redirect URI matches exactly."
        )

    connection = get_connection(session)
    if connection is None:
        connection = IntegrationConnection(provider=PROVIDER)
        session.add(connection)

    connection.environment = payload.environment
    connection.base_url = urls["base_url"]
    connection.auth_url = urls["auth_url"]
    connection.token_url = urls["token_url"]
    connection.client_id = client_id
    connection.encrypted_client_secret = store.encrypt(client_secret)
    connection.encrypted_access_token = store.encrypt(access_token)
    connection.encrypted_refresh_token = store.encrypt(refresh_token)
    connection.status = "configured"
    connection.validation_message = (
        "OAuth code exchanged. Validate the connection before importing."
    )
    connection.updated_at = utc_now()
    session.commit()
    return serialize_status(connection, store)


def list_bank_accounts(
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> list[FreeAgentBankAccount]:
    store = secret_store or SecretStore.from_settings()
    connection = require_connection(session)
    client = client_factory(connection.base_url, connection.token_url)
    try:
        accounts = call_with_token(
            connection,
            store,
            client,
            lambda access_token: client.get_bank_accounts(access_token),
        )
        sync_remote_accounts(session, connection, accounts)
        session.commit()
        return serialize_bank_accounts(accounts, session, connection)
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc


def manage_bank_account(
    payload: FreeAgentAccountManagementRequest,
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> FreeAgentBankAccount:
    store = secret_store or SecretStore.from_settings()
    connection = require_connection(session)
    client = client_factory(connection.base_url, connection.token_url)
    try:
        accounts = call_with_token(
            connection,
            store,
            client,
            lambda access_token: client.get_bank_accounts(access_token),
        )
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc

    remote_account = find_bank_account(accounts, payload.bank_account_url)
    managed_account = upsert_integration_account(session, connection, remote_account)
    managed_account.is_managed = payload.managed
    managed_account.auto_sync_enabled = payload.auto_sync_enabled
    managed_account.sync_interval_minutes = payload.sync_interval_minutes
    managed_account.last_sync_message = (
        "Auto sync enabled."
        if payload.auto_sync_enabled
        else "Auto sync paused; manual import remains available."
    )
    session.commit()
    return serialize_bank_account(remote_account, managed_account)


def import_bank_transactions(
    payload: FreeAgentImportRequest,
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> FreeAgentImportResult:
    store = secret_store or SecretStore.from_settings()
    connection = require_connection(session)
    if connection.status != "validated":
        raise FreeAgentIntegrationError("Validate the FreeAgent connection before importing.")

    client = client_factory(connection.base_url, connection.token_url)
    try:
        accounts = call_with_token(
            connection,
            store,
            client,
            lambda access_token: client.get_bank_accounts(access_token),
        )
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc

    remote_account = find_bank_account(accounts, payload.bank_account_url)
    managed_account = upsert_integration_account(session, connection, remote_account)
    updated_since = payload.updated_since or None
    if not payload.from_date and not payload.to_date and not updated_since:
        updated_since = managed_account.sync_cursor_updated_since or None
    if not payload.from_date and not payload.to_date and not updated_since:
        message = (
            "Choose a date range for the first FreeAgent import for this account. "
            "Incremental import is available after this account saves its own cursor."
        )
        raise FreeAgentIntegrationError(message)

    result = import_remote_account_transactions(
        payload,
        session,
        connection,
        managed_account,
        remote_account,
        client,
        store,
        updated_since,
    )
    session.commit()
    return result


def sync_all_managed_accounts(
    payload: FreeAgentSyncAllRequest,
    session: Session,
    secret_store: SecretStore | None = None,
    client_factory: FreeAgentClientFactory = FreeAgentApiClient,
) -> FreeAgentSyncAllResult:
    store = secret_store or SecretStore.from_settings()
    connection = require_connection(session)
    if connection.status != "validated":
        raise FreeAgentIntegrationError(
            "Validate the FreeAgent connection before syncing accounts."
        )

    client = client_factory(connection.base_url, connection.token_url)
    try:
        remote_accounts = call_with_token(
            connection,
            store,
            client,
            lambda access_token: client.get_bank_accounts(access_token),
        )
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc

    sync_remote_accounts(session, connection, remote_accounts)
    session.flush()

    results: list[FreeAgentImportResult] = []
    warnings: list[str] = []
    skipped_count = 0
    remote_by_url = {str(account.get("url") or ""): account for account in remote_accounts}
    managed_accounts = session.scalars(
        select(IntegrationAccount)
        .where(
            IntegrationAccount.connection_id == connection.id,
            IntegrationAccount.is_managed.is_(True),
        )
        .order_by(IntegrationAccount.external_account_name)
    ).all()

    for managed_account in managed_accounts:
        if payload.only_auto_sync_enabled and not managed_account.auto_sync_enabled:
            skipped_count += 1
            continue
        if not payload.force and not is_sync_due(managed_account):
            skipped_count += 1
            continue
        remote_account = remote_by_url.get(managed_account.external_account_url)
        if remote_account is None:
            managed_account.last_sync_status = "failed"
            managed_account.last_sync_message = "FreeAgent account was not returned by the API."
            warnings.append(
                f"{managed_account.external_account_name}: account not returned by FreeAgent."
            )
            continue

        updated_since = managed_account.sync_cursor_updated_since or None
        first_sync_from_date = date.today() - timedelta(days=payload.initial_lookback_days)
        import_payload = FreeAgentImportRequest(
            bank_account_url=managed_account.external_account_url,
            from_date=None if updated_since else first_sync_from_date,
            to_date=None if updated_since else date.today(),
            updated_since=updated_since,
            view="all",
            last_uploaded=False,
        )
        try:
            results.append(
                import_remote_account_transactions(
                    import_payload,
                    session,
                    connection,
                    managed_account,
                    remote_account,
                    client,
                    store,
                    updated_since,
                )
            )
        except FreeAgentIntegrationError as exc:
            managed_account.last_sync_status = "failed"
            managed_account.last_sync_message = str(exc)
            warnings.append(f"{managed_account.external_account_name}: {exc}")

    session.commit()
    return FreeAgentSyncAllResult(
        account_count=len(managed_accounts),
        synced_account_count=len(results),
        skipped_account_count=skipped_count,
        imported_transaction_count=sum(result.imported_transaction_count for result in results),
        skipped_duplicate_count=sum(result.skipped_duplicate_count for result in results),
        results=results,
        warnings=warnings,
    )


def import_remote_account_transactions(
    payload: FreeAgentImportRequest,
    session: Session,
    connection: IntegrationConnection,
    managed_account: IntegrationAccount,
    remote_account: dict[str, Any],
    client: FreeAgentApiClient,
    store: SecretStore,
    updated_since: str | None,
) -> FreeAgentImportResult:
    try:
        remote_transactions = call_with_token(
            connection,
            store,
            client,
            lambda access_token: client.get_bank_transactions(
                access_token=access_token,
                bank_account_url=payload.bank_account_url,
                from_date=payload.from_date.isoformat() if payload.from_date else None,
                to_date=payload.to_date.isoformat() if payload.to_date else None,
                updated_since=updated_since,
                view=payload.view,
                last_uploaded=payload.last_uploaded,
            ),
        )
    except FreeAgentApiError as exc:
        raise FreeAgentIntegrationError(str(exc)) from exc

    entity = get_or_create_household_entity(session)
    profile = get_or_create_default_profile(session, entity)
    account = upsert_account(session, entity.id, profile.id, remote_account)
    managed_account.local_account_id = account.id

    rows = [parse_remote_transaction(row) for row in remote_transactions]
    source_fingerprint = build_import_fingerprint(payload, rows)
    import_log = ImportLog(
        entity_id=entity.id,
        source="freeagent_api",
        source_filename=build_import_name(remote_account, payload, updated_since),
        source_fingerprint=source_fingerprint,
        row_count=len(rows),
        valid_row_count=len(rows),
        duplicate_fingerprint_count=0,
        imported_transaction_count=0,
        skipped_duplicate_count=0,
        date_start=min((row["date"] for row in rows), default=None),
        date_end=max((row["date"] for row in rows), default=None),
    )
    session.add(import_log)
    session.flush()

    imported_count = 0
    skipped_count = 0
    seen: set[str] = set()
    max_updated_at = connection.sync_cursor_updated_since or ""
    for row in rows:
        fingerprint = row["fingerprint"]
        if fingerprint in seen or transaction_exists(session, entity.id, fingerprint):
            skipped_count += 1
            seen.add(fingerprint)
            continue

        session.add(
            Transaction(
                entity_id=entity.id,
                account_id=account.id,
                import_id=import_log.id,
                transaction_date=row["date"],
                merchant_name=row["merchant_name"],
                description=row["description"],
                amount=row["amount"],
                direction="inflow" if row["amount"] > Decimal("0") else "outflow",
                source_category=row["source_category"],
                status="posted",
                transaction_type=row["transaction_type"],
                fingerprint=fingerprint,
                notes=row["notes"],
                sub_type=row["sub_type"],
            )
        )
        imported_count += 1
        seen.add(fingerprint)
        if row["updated_at"] and row["updated_at"] > max_updated_at:
            max_updated_at = row["updated_at"]

    import_log.imported_transaction_count = imported_count
    import_log.skipped_duplicate_count = skipped_count
    connection.selected_bank_account_url = str(
        remote_account.get("url") or payload.bank_account_url
    )
    connection.selected_bank_account_name = str(remote_account.get("name") or "")
    connection.last_synced_at = utc_now()
    connection.sync_cursor_updated_since = max(
        connection.sync_cursor_updated_since or "",
        max_updated_at,
    )
    managed_account.last_synced_at = connection.last_synced_at
    managed_account.last_balance_synced_at = connection.last_synced_at
    managed_account.sync_cursor_updated_since = max_updated_at
    managed_account.last_sync_status = "synced"
    managed_account.last_sync_message = (
        f"Imported {imported_count}; skipped {skipped_count} duplicate(s)."
    )
    managed_account.last_imported_transaction_count = imported_count
    managed_account.last_skipped_duplicate_count = skipped_count

    return FreeAgentImportResult(
        import_id=import_log.id,
        account_id=account.id,
        account_name=account.display_name,
        row_count=len(rows),
        imported_transaction_count=imported_count,
        skipped_duplicate_count=skipped_count,
        date_start=import_log.date_start.isoformat() if import_log.date_start else None,
        date_end=import_log.date_end.isoformat() if import_log.date_end else None,
        next_updated_since=managed_account.sync_cursor_updated_since or None,
        warnings=[],
    )


def get_working_access_token(
    connection: IntegrationConnection,
    store: SecretStore,
    client: FreeAgentApiClient,
) -> str:
    access_token = store.decrypt(connection.encrypted_access_token)
    if access_token:
        return access_token

    return refresh_access_token(connection, store, client)


def call_with_token[T](
    connection: IntegrationConnection,
    store: SecretStore,
    client: FreeAgentApiClient,
    operation: Callable[[str], T],
) -> T:
    access_token = get_working_access_token(connection, store, client)
    try:
        return operation(access_token)
    except FreeAgentApiError as exc:
        if exc.status_code != 401:
            raise
        if not store.decrypt(connection.encrypted_refresh_token):
            message = (
                "The access token was rejected or expired. Add a refresh token, "
                "or paste a fresh access token and validate again."
            )
            raise FreeAgentIntegrationError(
                message
            ) from exc
    refreshed_access_token = refresh_access_token(connection, store, client)
    return operation(refreshed_access_token)


def refresh_access_token(
    connection: IntegrationConnection,
    store: SecretStore,
    client: FreeAgentApiClient,
) -> str:
    refresh_token = store.decrypt(connection.encrypted_refresh_token)
    if not refresh_token:
        raise FreeAgentIntegrationError("Add a FreeAgent access token or refresh token first.")
    refreshed = client.refresh_access_token(
        client_id=connection.client_id,
        client_secret=store.decrypt(connection.encrypted_client_secret),
        refresh_token=refresh_token,
    )
    next_access_token = str(refreshed.get("access_token") or "")
    if not next_access_token:
        raise FreeAgentIntegrationError("FreeAgent did not return a refreshed access token.")
    connection.encrypted_access_token = store.encrypt(next_access_token)
    if refreshed.get("refresh_token"):
        connection.encrypted_refresh_token = store.encrypt(str(refreshed["refresh_token"]))
    return next_access_token


def get_connection(session: Session) -> IntegrationConnection | None:
    return session.scalar(
        select(IntegrationConnection).where(IntegrationConnection.provider == PROVIDER)
    )


def require_connection(session: Session) -> IntegrationConnection:
    connection = get_connection(session)
    if connection is None:
        raise FreeAgentIntegrationError("Configure FreeAgent credentials first.")
    return connection


def resolve_urls(payload: FreeAgentCredentials) -> dict[str, str]:
    if payload.environment == "sandbox":
        base_url = SANDBOX_BASE_URL
    elif payload.environment == "custom":
        if payload.base_url is None:
            raise FreeAgentIntegrationError("Custom FreeAgent base URL is required.")
        base_url = str(payload.base_url).rstrip("/")
    else:
        base_url = PRODUCTION_BASE_URL

    return {
        "base_url": base_url,
        "auth_url": str(payload.auth_url or f"{base_url}/v2/approve_app"),
        "token_url": str(payload.token_url or f"{base_url}/v2/token_endpoint"),
    }


def normalize_secret(value: str | None) -> str:
    return (value or "").strip()


def normalize_oauth_token(value: str | None) -> str:
    token = normalize_secret(value)
    lowered = token.lower()
    if lowered.startswith("bearer "):
        return token[7:].strip()
    if lowered.startswith("authorization: bearer "):
        return token[22:].strip()
    return token


def serialize_status(
    connection: IntegrationConnection,
    store: SecretStore,
) -> FreeAgentConnectionStatus:
    return FreeAgentConnectionStatus(
        configured=True,
        validated=connection.status == "validated",
        status=connection.status,
        message=connection.validation_message,
        environment=connection.environment,
        base_url=connection.base_url,
        auth_url=connection.auth_url,
        token_url=connection.token_url,
        client_id_last4=connection.client_id[-4:] if connection.client_id else None,
        company_name=connection.company_name or None,
        company_url=connection.company_url or None,
        selected_bank_account_url=connection.selected_bank_account_url or None,
        selected_bank_account_name=connection.selected_bank_account_name or None,
        sync_cursor_updated_since=connection.sync_cursor_updated_since or None,
        last_validated_at=connection.last_validated_at.isoformat()
        if connection.last_validated_at
        else None,
        last_synced_at=connection.last_synced_at.isoformat() if connection.last_synced_at else None,
        secret_storage=store.description,
    )


def serialize_bank_accounts(
    accounts: list[dict[str, Any]],
    session: Session,
    connection: IntegrationConnection,
) -> list[FreeAgentBankAccount]:
    managed_by_url = {
        account.external_account_url: account
        for account in session.scalars(
            select(IntegrationAccount).where(IntegrationAccount.connection_id == connection.id)
        )
    }
    return [
        serialize_bank_account(account, managed_by_url.get(str(account.get("url") or "")))
        for account in accounts
    ]


def serialize_bank_account(
    account: dict[str, Any],
    managed_account: IntegrationAccount | None = None,
) -> FreeAgentBankAccount:
    return FreeAgentBankAccount(
        url=str(account.get("url") or ""),
        name=str(account.get("name") or "Unnamed account"),
        bank_name=account.get("bank_name"),
        type=str(account.get("type") or "Unknown"),
        status=str(account.get("status") or "unknown"),
        currency=str(account.get("currency") or ""),
        current_balance=format_optional(account.get("current_balance")),
        latest_activity_date=account.get("latest_activity_date"),
        updated_at=account.get("updated_at"),
        is_personal=bool(account.get("is_personal", False)),
        is_primary=bool(account.get("is_primary", False)),
        local_account_id=managed_account.local_account_id or None if managed_account else None,
        managed=managed_account.is_managed if managed_account else True,
        auto_sync_enabled=managed_account.auto_sync_enabled if managed_account else False,
        sync_interval_minutes=(
            managed_account.sync_interval_minutes
            if managed_account
            else DAILY_SYNC_INTERVAL_MINUTES
        ),
        sync_cursor_updated_since=(
            managed_account.sync_cursor_updated_since or None if managed_account else None
        ),
        last_synced_at=(
            managed_account.last_synced_at.isoformat()
            if managed_account and managed_account.last_synced_at
            else None
        ),
        next_sync_due_at=next_sync_due_at(managed_account),
        last_sync_status=managed_account.last_sync_status if managed_account else "never_synced",
        last_sync_message=managed_account.last_sync_message or None if managed_account else None,
    )


def sync_remote_accounts(
    session: Session,
    connection: IntegrationConnection,
    accounts: list[dict[str, Any]],
) -> None:
    for account in accounts:
        upsert_integration_account(session, connection, account)
    session.flush()


def upsert_integration_account(
    session: Session,
    connection: IntegrationConnection,
    remote_account: dict[str, Any],
) -> IntegrationAccount:
    external_url = str(remote_account.get("url") or "")
    if not external_url:
        raise FreeAgentIntegrationError("FreeAgent returned a bank account without a URL.")
    account = session.scalar(
        select(IntegrationAccount).where(
            IntegrationAccount.connection_id == connection.id,
            IntegrationAccount.external_account_url == external_url,
        )
    )
    if account is None:
        account = IntegrationAccount(
            connection_id=connection.id,
            provider=PROVIDER,
            external_account_url=external_url,
            is_managed=True,
            auto_sync_enabled=False,
            sync_interval_minutes=DAILY_SYNC_INTERVAL_MINUTES,
            last_sync_status="never_synced",
            last_sync_message="Ready for manual import or scheduled sync.",
        )
        session.add(account)
    account.provider = PROVIDER
    account.external_account_name = str(remote_account.get("name") or "Unnamed account")
    return account


def is_sync_due(account: IntegrationAccount) -> bool:
    return utc_now() >= next_daily_sync_datetime(account.last_synced_at)


def next_sync_due_at(account: IntegrationAccount | None) -> str | None:
    if account is None or not account.auto_sync_enabled:
        return None
    return next_daily_sync_datetime(account.last_synced_at).isoformat()


def next_daily_sync_datetime(last_synced_at: datetime | None) -> datetime:
    now = utc_now()
    today_six = datetime.combine(now.date(), time(DAILY_SYNC_HOUR, 0), tzinfo=now.tzinfo)
    if last_synced_at is None:
        return today_six if now < today_six else today_six + timedelta(days=1)
    next_run = datetime.combine(
        last_synced_at.date() + timedelta(days=1),
        time(DAILY_SYNC_HOUR, 0),
        tzinfo=last_synced_at.tzinfo or now.tzinfo,
    )
    if next_run <= last_synced_at:
        next_run += timedelta(days=1)
    return next_run


def find_bank_account(accounts: list[dict[str, Any]], bank_account_url: str) -> dict[str, Any]:
    for account in accounts:
        if account.get("url") == bank_account_url:
            return account
    raise FreeAgentIntegrationError("Selected FreeAgent bank account was not found.")


def upsert_account(
    session: Session,
    entity_id: str,
    profile_id: str,
    remote_account: dict[str, Any],
) -> Account:
    source_name = source_account_name(remote_account)
    account = session.scalar(
        select(Account).where(
            Account.entity_id == entity_id,
            Account.provider == PROVIDER_LABEL,
            Account.source_account_name == source_name,
        )
    )
    if account is None:
        account = Account(
            entity_id=entity_id,
            profile_id=profile_id,
            provider=PROVIDER_LABEL,
            display_name=str(remote_account.get("name") or source_name),
            source_account_name=source_name,
            account_type=map_account_type(remote_account),
        )
        session.add(account)
        session.flush()

    account.display_name = str(remote_account.get("name") or account.display_name)
    account.account_type = map_account_type(remote_account)
    account.current_balance = parse_decimal(remote_account.get("current_balance"))
    account.balance_as_of = parse_date(remote_account.get("latest_activity_date")) or date.today()
    include_as_cash = account.account_type not in {"credit_card", "loan", "bnpl"}
    account.include_in_cash_on_hand = include_as_cash
    account.include_in_forecast = include_as_cash
    account.status = str(remote_account.get("status") or "active")
    return account


def parse_remote_transaction(row: dict[str, Any]) -> dict[str, Any]:
    amount = parse_decimal(row.get("amount")) or Decimal("0")
    description = clean(str(row.get("description") or row.get("full_description") or ""))
    explanation_type = first_explanation_type(row)
    source_category = explanation_type or "FreeAgent unexplained"
    transaction_type = (
        "internal_transfer_candidate"
        if "transfer" in source_category.lower()
        else initial_transaction_type("Income" if amount > 0 else source_category)
    )
    return {
        "date": parse_date(row.get("dated_on")) or date.today(),
        "merchant_name": description[:255],
        "description": clean(str(row.get("full_description") or description))[:500],
        "amount": amount,
        "source_category": source_category[:120],
        "transaction_type": transaction_type,
        "fingerprint": build_transaction_fingerprint(row),
        "notes": clean(str(row.get("url") or ""))[:500],
        "sub_type": "manual" if row.get("is_manual") else "api",
        "updated_at": str(row.get("updated_at") or ""),
    }


def first_explanation_type(row: dict[str, Any]) -> str:
    explanations = row.get("bank_transaction_explanations")
    if isinstance(explanations, list) and explanations:
        first = explanations[0]
        if isinstance(first, dict):
            return clean(str(first.get("type") or first.get("category") or ""))
    return ""


def build_transaction_fingerprint(row: dict[str, Any]) -> str:
    raw = "|".join(
        [
            PROVIDER,
            str(row.get("url") or ""),
            str(row.get("transaction_id") or ""),
            str(row.get("dated_on") or ""),
            str(row.get("amount") or ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def build_import_fingerprint(
    payload: FreeAgentImportRequest,
    rows: list[dict[str, Any]],
) -> str:
    raw = "|".join(
        [
            payload.bank_account_url,
            payload.from_date.isoformat() if payload.from_date else "",
            payload.to_date.isoformat() if payload.to_date else "",
            payload.updated_since or "",
            *[row["fingerprint"] for row in rows],
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def build_import_name(
    remote_account: dict[str, Any],
    payload: FreeAgentImportRequest,
    updated_since: str | None,
) -> str:
    account_name = str(remote_account.get("name") or "FreeAgent account")
    if updated_since:
        return f"{account_name} updated since {updated_since}"
    if payload.from_date or payload.to_date:
        return f"{account_name} {payload.from_date or 'start'} to {payload.to_date or 'today'}"
    return f"{account_name} incremental"


def source_account_name(remote_account: dict[str, Any]) -> str:
    identifier = str(remote_account.get("url") or "").rstrip("/").split("/")[-1]
    name = str(remote_account.get("name") or "FreeAgent account")
    return f"{name} [{identifier}]" if identifier else name


def map_account_type(remote_account: dict[str, Any]) -> str:
    account_type = str(remote_account.get("type") or "").lower()
    name = str(remote_account.get("name") or "").lower()
    if "creditcard" in account_type or "credit card" in name or "american express" in name:
        return "credit_card"
    if "loan" in account_type or "loan" in name:
        return "loan"
    if "savings" in name or "pot" in name:
        return "savings"
    return "current"


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value)).quantize(Decimal("0.01"))


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    return date.fromisoformat(str(value)[:10])


def format_optional(value: Any) -> str | None:
    amount = parse_decimal(value)
    return format_money(amount) if amount is not None else None
