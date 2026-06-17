from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Account, ImportLog, IntegrationAccount, IntegrationConnection, Transaction
from app.schemas.plaid import (
    PlaidAccountPreview,
    PlaidExchangeRequest,
    PlaidImportRequest,
    PlaidImportResult,
    PlaidLinkToken,
    PlaidPreview,
    PlaidStatus,
    PlaidTransactionPreview,
)
from app.services.import_commit import get_or_create_default_profile, get_or_create_household_entity
from app.services.plaid_client import PlaidApiClient, PlaidApiError
from app.services.secret_store import SecretStore
from app.services.snoop_import import clean, initial_transaction_type

PROVIDER = "plaid"
PROVIDER_LABEL = "Plaid"


class PlaidIntegrationError(ValueError):
    """Raised when Plaid setup or import cannot continue."""


def get_status(
    session: Session,
    *,
    secret_store: SecretStore | None = None,
) -> PlaidStatus:
    store = secret_store or SecretStore.from_settings()
    connection = get_connection(session)
    client_id, secret = plaid_credentials(required=False)
    configured = bool(client_id and secret)
    if connection is None:
        return PlaidStatus(
            account_count=0,
            client_id_last4=client_id[-4:] if client_id else None,
            configured=configured,
            connected=False,
            environment=plaid_environment(),
            item_count=0,
            message=(
                "Plaid credentials ready. Create a Link token to connect a bank."
                if configured
                else "Add PLAID_CLIENT_ID and PLAID_SECRET to .env, then restart the backend."
            ),
            products=plaid_products(),
            secret_storage=store.description,
        )

    accounts = session.scalars(
        select(IntegrationAccount).where(IntegrationAccount.connection_id == connection.id)
    ).all()
    item_ids = {account.provider for account in accounts}
    return PlaidStatus(
        account_count=len(accounts),
        client_id_last4=client_id[-4:] if client_id else connection.client_id[-4:] or None,
        configured=configured or bool(connection.client_id and connection.encrypted_client_secret),
        connected=bool(read_access_tokens(connection, store)),
        environment=connection.environment or plaid_environment(),
        item_count=len(item_ids),
        last_synced_at=connection.last_synced_at.isoformat() if connection.last_synced_at else None,
        message=connection.validation_message or "Plaid configured.",
        products=plaid_products(),
        secret_storage=store.description,
    )


def create_link_token(
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: PlaidApiClient | None = None,
) -> PlaidLinkToken:
    store = secret_store or SecretStore.from_settings()
    api_client = client or PlaidApiClient(plaid_environment())
    client_id, secret = plaid_credentials(required=True)
    connection = get_or_create_connection(session, store, client_id, secret, api_client)
    try:
        payload = api_client.create_link_token(
            client_id=client_id,
            client_name="Personal Finance Studio",
            country_codes=plaid_country_codes(),
            products=plaid_link_products(),
            secret=secret,
            user_id=connection.id,
        )
    except PlaidApiError as exc:
        raise PlaidIntegrationError(str(exc)) from exc
    return PlaidLinkToken(
        expiration=payload.get("expiration"),
        link_token=str(payload.get("link_token") or ""),
        request_id=payload.get("request_id"),
    )


def exchange_public_token(
    payload: PlaidExchangeRequest,
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: PlaidApiClient | None = None,
) -> PlaidStatus:
    store = secret_store or SecretStore.from_settings()
    api_client = client or PlaidApiClient(plaid_environment())
    client_id, secret = plaid_credentials(required=True)
    connection = get_or_create_connection(session, store, client_id, secret, api_client)
    try:
        exchange = api_client.exchange_public_token(
            client_id=client_id,
            public_token=payload.public_token,
            secret=secret,
        )
    except PlaidApiError as exc:
        raise PlaidIntegrationError(str(exc)) from exc

    item_id = clean(str(exchange.get("item_id") or ""))
    access_token = clean(str(exchange.get("access_token") or ""))
    if not item_id or not access_token:
        raise PlaidIntegrationError("Plaid did not return an item access token.")

    tokens = read_access_tokens(connection, store)
    tokens[item_id] = access_token
    connection.encrypted_access_token = store.encrypt(json.dumps(tokens))
    item_labels = read_item_labels(connection)
    item_labels[item_id] = clean(payload.institution_name or "") or "Plaid"
    connection.company_url = json.dumps(item_labels)
    connection.status = "validated"
    connection.validation_message = (
        f"Connected {payload.institution_name or 'Plaid institution'}."
    )
    connection.last_validated_at = datetime.now(UTC)
    session.commit()
    return get_status(session, secret_store=store)


def preview_plaid(
    session: Session,
    *,
    days: int = 30,
    secret_store: SecretStore | None = None,
    client: PlaidApiClient | None = None,
) -> PlaidPreview:
    store = secret_store or SecretStore.from_settings()
    api_client = client or PlaidApiClient(plaid_environment())
    client_id, secret = plaid_credentials(required=True)
    connection = require_connection(session)
    tokens = read_access_tokens(connection, store)
    accounts: list[PlaidAccountPreview] = []
    transactions: list[PlaidTransactionPreview] = []
    for item_id, access_token in tokens.items():
        accounts.extend(
            fetch_account_previews(api_client, client_id, secret, access_token, item_id)
        )
        transactions.extend(
            fetch_transaction_previews(
                api_client,
                client_id,
                secret,
                access_token,
                days=days,
            )
        )
    return PlaidPreview(
        accounts=accounts,
        transaction_count=len(transactions),
        transactions=transactions[:25],
    )


def import_plaid(
    payload: PlaidImportRequest,
    session: Session,
    *,
    secret_store: SecretStore | None = None,
    client: PlaidApiClient | None = None,
) -> PlaidImportResult:
    store = secret_store or SecretStore.from_settings()
    api_client = client or PlaidApiClient(plaid_environment())
    client_id, secret = plaid_credentials(required=True)
    connection = require_connection(session)
    tokens = read_access_tokens(connection, store)
    if not tokens:
        raise PlaidIntegrationError("Connect at least one bank with Plaid first.")

    entity = get_or_create_household_entity(session)
    profile = get_or_create_default_profile(session, entity)
    import_log = ImportLog(
        entity_id=entity.id,
        source="plaid",
        source_filename=f"Plaid {connection.environment}",
        source_fingerprint=hashlib.sha256(
            f"plaid|{connection.id}|{datetime.now(UTC).isoformat()}".encode()
        ).hexdigest(),
        row_count=0,
        valid_row_count=0,
        duplicate_fingerprint_count=0,
        imported_transaction_count=0,
        skipped_duplicate_count=0,
    )
    session.add(import_log)
    session.flush()

    account_count = 0
    imported_count = 0
    skipped_count = 0
    transaction_count = 0
    for item_id, access_token in tokens.items():
        accounts_response = plaid_call(
            api_client.accounts_balance_get,
            access_token=access_token,
            client_id=client_id,
            secret=secret,
        )
        institution_name = institution_label(session, connection.id, item_id)
        plaid_accounts = accounts_response.get("accounts", [])
        plaid_to_local: dict[str, Account] = {}
        for plaid_account in plaid_accounts:
            account = upsert_plaid_account(
                session,
                connection,
                entity_id=entity.id,
                profile_id=profile.id,
                item_id=item_id,
                institution_name=institution_name,
                plaid_account=plaid_account,
            )
            plaid_to_local[str(plaid_account.get("account_id"))] = account
            account_count += 1

        transactions_response = fetch_all_transactions(
            api_client,
            client_id,
            secret,
            access_token,
            days=max(1, min(payload.days, 730)),
        )
        transactions = transactions_response.get("transactions", [])
        transaction_count += len(transactions)
        if transactions:
            dates = [date.fromisoformat(str(tx["date"])) for tx in transactions if tx.get("date")]
            if dates:
                import_log.date_start = min(
                    [import_log.date_start, *dates] if import_log.date_start else dates
                )
                import_log.date_end = max(
                    [import_log.date_end, *dates] if import_log.date_end else dates
                )
        for plaid_transaction in transactions:
            local_account = plaid_to_local.get(str(plaid_transaction.get("account_id")))
            if local_account is None:
                continue
            fingerprint = plaid_fingerprint(plaid_transaction)
            if transaction_exists(session, entity.id, fingerprint):
                skipped_count += 1
                continue
            session.add(
                Transaction(
                    entity_id=entity.id,
                    account_id=local_account.id,
                    import_id=import_log.id,
                    transaction_date=date.fromisoformat(str(plaid_transaction["date"])),
                    merchant_name=clean(
                        str(plaid_transaction.get("merchant_name") or "")
                    )[:255],
                    description=clean(str(plaid_transaction.get("name") or ""))[:500],
                    amount=plaid_amount(plaid_transaction),
                    direction="inflow"
                    if plaid_amount(plaid_transaction) > Decimal("0")
                    else "outflow",
                    source_category=plaid_category(plaid_transaction),
                    status="pending" if plaid_transaction.get("pending") else "posted",
                    transaction_type=initial_transaction_type(
                        plaid_category(plaid_transaction)
                    ),
                    fingerprint=fingerprint,
                    notes="Imported from Plaid",
                    sub_type=clean(str(plaid_transaction.get("payment_channel") or ""))[:120],
                )
            )
            imported_count += 1

        connection.last_synced_at = datetime.now(UTC)

    import_log.row_count = transaction_count
    import_log.valid_row_count = transaction_count
    import_log.imported_transaction_count = imported_count
    import_log.skipped_duplicate_count = skipped_count
    connection.status = "validated"
    connection.validation_message = (
        f"Imported {imported_count} Plaid transaction(s); skipped {skipped_count} duplicate(s)."
    )
    session.commit()
    return PlaidImportResult(
        account_count=account_count,
        imported_transaction_count=imported_count,
        skipped_duplicate_count=skipped_count,
        synced_item_count=len(tokens),
        transaction_count=transaction_count,
    )


def fetch_account_previews(
    api_client: PlaidApiClient,
    client_id: str,
    secret: str,
    access_token: str,
    item_id: str,
) -> list[PlaidAccountPreview]:
    response = plaid_call(
        api_client.accounts_balance_get,
        access_token=access_token,
        client_id=client_id,
        secret=secret,
    )
    institution_name = clean(str(response.get("item", {}).get("institution_name") or item_id))
    return [
        PlaidAccountPreview(
            account_id=str(account.get("account_id")),
            available_balance=format_optional_minor(account.get("balances", {}).get("available")),
            current_balance=format_optional_minor(account.get("balances", {}).get("current")),
            institution_name=institution_name,
            limit=format_optional_minor(account.get("balances", {}).get("limit")),
            mask=account.get("mask"),
            name=clean(str(account.get("name") or "Plaid account")),
            official_name=account.get("official_name"),
            subtype=account.get("subtype"),
            type=str(account.get("type") or "unknown"),
        )
        for account in response.get("accounts", [])
    ]


def fetch_transaction_previews(
    api_client: PlaidApiClient,
    client_id: str,
    secret: str,
    access_token: str,
    *,
    days: int,
) -> list[PlaidTransactionPreview]:
    transactions = fetch_all_transactions(
        api_client,
        client_id,
        secret,
        access_token,
        days=days,
    ).get("transactions", [])
    return [
        PlaidTransactionPreview(
            account_id=str(tx.get("account_id")),
            amount=format_money(plaid_amount(tx)),
            category=plaid_category(tx),
            date=str(tx.get("date")),
            merchant_name=clean(str(tx.get("merchant_name") or "")),
            name=clean(str(tx.get("name") or "")),
            pending=bool(tx.get("pending")),
            transaction_id=str(tx.get("transaction_id")),
        )
        for tx in transactions
    ]


def fetch_all_transactions(
    api_client: PlaidApiClient,
    client_id: str,
    secret: str,
    access_token: str,
    *,
    days: int,
) -> dict[str, Any]:
    end_date = date.today()
    start_date = end_date - timedelta(days=max(1, min(days, 730)))
    all_transactions: list[dict[str, Any]] = []
    total_transactions = 0
    offset = 0
    while True:
        response = plaid_call(
            api_client.transactions_get,
            access_token=access_token,
            client_id=client_id,
            count=250,
            end_date=end_date.isoformat(),
            offset=offset,
            secret=secret,
            start_date=start_date.isoformat(),
        )
        transactions = response.get("transactions", [])
        all_transactions.extend(transactions)
        total_transactions = int(response.get("total_transactions") or len(all_transactions))
        if len(all_transactions) >= total_transactions or not transactions:
            break
        offset += len(transactions)
    return {"transactions": all_transactions, "total_transactions": total_transactions}


def get_or_create_connection(
    session: Session,
    store: SecretStore,
    client_id: str,
    secret: str,
    api_client: PlaidApiClient,
) -> IntegrationConnection:
    connection = get_connection(session)
    if connection is None:
        connection = IntegrationConnection(
            provider=PROVIDER,
            environment=plaid_environment(),
            base_url=api_client.base_url,
            auth_url="https://cdn.plaid.com/link/v2/stable/link-initialize.js",
            token_url=api_client.base_url,
        )
        session.add(connection)
        session.flush()
    connection.client_id = client_id
    connection.encrypted_client_secret = store.encrypt(secret)
    connection.environment = plaid_environment()
    connection.base_url = api_client.base_url
    connection.company_name = PROVIDER_LABEL
    return connection


def upsert_plaid_account(
    session: Session,
    connection: IntegrationConnection,
    *,
    entity_id: str,
    profile_id: str,
    item_id: str,
    institution_name: str,
    plaid_account: dict[str, Any],
) -> Account:
    external_account_id = str(plaid_account.get("account_id"))
    integration_account = session.scalar(
        select(IntegrationAccount).where(
            IntegrationAccount.connection_id == connection.id,
            IntegrationAccount.external_account_url == external_account_id,
        )
    )
    account_name = plaid_account_name(institution_name, plaid_account)
    account = None
    if integration_account and integration_account.local_account_id:
        account = session.get(Account, integration_account.local_account_id)
    if account is None:
        account = session.scalar(
            select(Account).where(
                Account.entity_id == entity_id,
                Account.provider == institution_name,
                Account.source_account_name == account_name,
            )
        )
    if account is None:
        account_type = plaid_account_type(plaid_account)
        include_cash = account_type not in {"bnpl", "credit_card", "loan"}
        account = Account(
            entity_id=entity_id,
            profile_id=profile_id,
            provider=institution_name,
            display_name=account_name,
            source_account_name=account_name,
            account_type=account_type,
            include_in_cash_on_hand=include_cash,
            include_in_forecast=include_cash,
        )
        session.add(account)
        session.flush()

    account.account_type = plaid_account_type(plaid_account)
    balances = plaid_account.get("balances", {})
    account.current_balance = plaid_account_balance(plaid_account)
    account.overdraft_limit = decimal_or_none(balances.get("limit"))
    account.balance_as_of = date.today()
    if account.account_type in {"bnpl", "credit_card", "loan"}:
        account.include_in_cash_on_hand = False
        account.include_in_forecast = False

    if integration_account is None:
        integration_account = IntegrationAccount(
            connection_id=connection.id,
            provider=item_id,
            external_account_url=external_account_id,
        )
        session.add(integration_account)
    integration_account.external_account_name = account_name
    integration_account.local_account_id = account.id
    integration_account.last_balance_synced_at = datetime.now(UTC)
    integration_account.last_sync_status = "ready"
    integration_account.last_sync_message = "Balance synced from Plaid."
    return account


def plaid_account_balance(plaid_account: dict[str, Any]) -> Decimal | None:
    current = decimal_or_none(plaid_account.get("balances", {}).get("current"))
    if current is None:
        return None
    if plaid_account_type(plaid_account) in {"bnpl", "credit_card", "loan"}:
        return -abs(current)
    return current


def plaid_amount(plaid_transaction: dict[str, Any]) -> Decimal:
    amount = decimal_or_none(plaid_transaction.get("amount")) or Decimal("0.00")
    # Plaid returns positive numbers for money leaving the account.
    return (-amount).quantize(Decimal("0.01"))


def plaid_category(plaid_transaction: dict[str, Any]) -> str:
    categories = plaid_transaction.get("category") or []
    if categories:
        return clean(str(categories[0])) or "Plaid uncategorized"
    personal = plaid_transaction.get("personal_finance_category") or {}
    return clean(str(personal.get("primary") or "")) or "Plaid uncategorized"


def plaid_account_name(institution_name: str, plaid_account: dict[str, Any]) -> str:
    name = clean(str(plaid_account.get("official_name") or plaid_account.get("name") or "Account"))
    mask = clean(str(plaid_account.get("mask") or ""))
    suffix = f" • {mask}" if mask else ""
    return f"{institution_name} {name}{suffix}"


def plaid_account_type(plaid_account: dict[str, Any]) -> str:
    account_type = str(plaid_account.get("type") or "").lower()
    subtype = str(plaid_account.get("subtype") or "").lower()
    if account_type == "credit":
        return "credit_card"
    if account_type == "loan":
        return "loan"
    if subtype in {"savings", "cash isa", "isa"}:
        return "savings"
    if account_type in {"depository", "investment"} and subtype != "savings":
        return "current"
    return "unknown"


def institution_label(session: Session, connection_id: str, item_id: str) -> str:
    connection = session.get(IntegrationConnection, connection_id)
    if connection is not None:
        item_labels = read_item_labels(connection)
        if item_labels.get(item_id):
            return item_labels[item_id]
    row = session.scalar(
        select(IntegrationAccount).where(
            IntegrationAccount.connection_id == connection_id,
            IntegrationAccount.provider == item_id,
        )
    )
    if row and row.external_account_name:
        return row.external_account_name.split(" ", 1)[0]
    return "Plaid"


def read_item_labels(connection: IntegrationConnection) -> dict[str, str]:
    if not connection.company_url:
        return {}
    try:
        payload = json.loads(connection.company_url)
    except json.JSONDecodeError:
        return {}
    return {str(key): clean(str(value)) for key, value in payload.items() if value}


def read_access_tokens(connection: IntegrationConnection, store: SecretStore) -> dict[str, str]:
    raw = store.decrypt(connection.encrypted_access_token)
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return {str(key): str(value) for key, value in payload.items() if value}


def plaid_credentials(*, required: bool) -> tuple[str, str]:
    settings = get_settings()
    client_id = clean(settings.plaid_client_id or "")
    secret = clean(settings.plaid_secret or "")
    if required and (not client_id or not secret):
        raise PlaidIntegrationError(
            "Set PLAID_CLIENT_ID and PLAID_SECRET in .env, then restart the backend."
        )
    return client_id, secret


def plaid_environment() -> str:
    env = clean(get_settings().plaid_env or "sandbox").lower()
    # Plaid retired the old Development host in 2024. Real-bank trial access now
    # uses the Production API, so keep the legacy env value working locally.
    if env == "development":
        return "production"
    return env if env in {"sandbox", "production"} else "sandbox"


def plaid_products() -> list[str]:
    return get_settings().plaid_product_list or ["transactions"]


def plaid_link_products() -> list[str]:
    products = [product for product in plaid_products() if product != "balance"]
    return products or ["transactions"]


def plaid_country_codes() -> list[str]:
    return get_settings().plaid_country_code_list or ["GB"]


def get_connection(session: Session) -> IntegrationConnection | None:
    return session.scalar(
        select(IntegrationConnection).where(IntegrationConnection.provider == PROVIDER)
    )


def require_connection(session: Session) -> IntegrationConnection:
    connection = get_connection(session)
    if connection is None:
        raise PlaidIntegrationError("Create a Plaid Link token and connect a bank first.")
    return connection


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


def plaid_fingerprint(plaid_transaction: dict[str, Any]) -> str:
    return hashlib.sha256(
        f"plaid|{plaid_transaction.get('transaction_id')}".encode()
    ).hexdigest()


def decimal_or_none(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def format_optional_minor(value: Any) -> str | None:
    decimal = decimal_or_none(value)
    return format_money(decimal) if decimal is not None else None


def format_money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def plaid_call(function, **kwargs):
    try:
        return function(**kwargs)
    except PlaidApiError as exc:
        raise PlaidIntegrationError(str(exc)) from exc
