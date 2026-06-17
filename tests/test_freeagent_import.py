from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, ImportLog, IntegrationAccount, IntegrationConnection, Transaction
from app.routes.freeagent import get_freeagent_client_factory
from app.schemas.freeagent import (
    FreeAgentAccountManagementRequest,
    FreeAgentCredentials,
    FreeAgentImportRequest,
    FreeAgentOAuthExchangeRequest,
    FreeAgentSyncAllRequest,
)
from app.schemas.transactions import TransactionUpdate
from app.services.freeagent_client import parse_next_link
from app.services.freeagent_import import (
    FreeAgentIntegrationError,
    exchange_authorization_code,
    import_bank_transactions,
    manage_bank_account,
    save_credentials,
    sync_all_managed_accounts,
    validate_connection,
)
from app.services.secret_store import SecretStore, normalize_key
from app.services.transactions import update_transaction

COMPANY = {
    "url": "https://api.freeagent.com/v2/company",
    "name": "Example Ltd",
}

BANK_ACCOUNTS = [
    {
        "url": "https://api.freeagent.com/v2/bank_accounts/2010760",
        "bank_name": "HSBC",
        "type": "StandardBankAccount",
        "name": "Hsbc Personal",
        "status": "active",
        "currency": "GBP",
        "current_balance": "-409.88",
        "latest_activity_date": "2026-06-14",
        "updated_at": "2026-06-15T11:33:00.000Z",
        "is_personal": True,
        "is_primary": False,
    }
]

BANK_TRANSACTIONS = [
    {
        "url": "https://api.freeagent.com/v2/bank_transactions/779598363",
        "amount": "-100.0",
        "bank_account": "https://api.freeagent.com/v2/bank_accounts/2010760",
        "dated_on": "2026-06-14",
        "description": "Day to Day Exp///",
        "full_description": "Day to Day Exp///100.00",
        "transaction_id": "txn-1",
        "is_manual": False,
        "updated_at": "2026-06-15T11:11:27.000Z",
        "bank_transaction_explanations": [],
    },
    {
        "url": "https://api.freeagent.com/v2/bank_transactions/779598372",
        "amount": "2000.0",
        "bank_account": "https://api.freeagent.com/v2/bank_accounts/2010760",
        "dated_on": "2026-06-10",
        "description": "BARCLAYCARD///",
        "full_description": "BARCLAYCARD///2000.00",
        "transaction_id": "txn-2",
        "is_manual": False,
        "updated_at": "2026-06-15T11:12:27.000Z",
        "bank_transaction_explanations": [],
    },
]

MONZO_ACCOUNT = {
    "url": "https://api.freeagent.com/v2/bank_accounts/2020202",
    "bank_name": "Monzo",
    "type": "StandardBankAccount",
    "name": "Monzo Personal",
    "status": "active",
    "currency": "GBP",
    "current_balance": "590.12",
    "latest_activity_date": "2026-06-16",
    "updated_at": "2026-06-16T08:30:00.000Z",
    "is_personal": True,
    "is_primary": False,
}

MONZO_TRANSACTIONS = [
    {
        "url": "https://api.freeagent.com/v2/bank_transactions/880000001",
        "amount": "-40.0",
        "bank_account": MONZO_ACCOUNT["url"],
        "dated_on": "2026-06-16",
        "description": "MONZO GROCERIES///",
        "full_description": "MONZO GROCERIES///40.00",
        "transaction_id": "monzo-txn-1",
        "is_manual": False,
        "updated_at": "2026-06-16T08:45:00.000Z",
        "bank_transaction_explanations": [],
    }
]


class FakeFreeAgentClient:
    def __init__(self, base_url: str, token_url: str) -> None:
        self.base_url = base_url
        self.token_url = token_url
        self.last_transaction_query: dict[str, object] | None = None

    def get_company(self, access_token: str):
        assert access_token == "access-token"
        return COMPANY

    def get_bank_accounts(self, access_token: str):
        assert access_token == "access-token"
        return BANK_ACCOUNTS

    def get_bank_transactions(self, **kwargs):
        self.last_transaction_query = kwargs
        assert kwargs["bank_account_url"] == BANK_ACCOUNTS[0]["url"]
        assert kwargs.get("per_page", 100) == 100
        return BANK_TRANSACTIONS

    def exchange_authorization_code(self, **kwargs):
        assert kwargs["code"] == "auth-code"
        assert kwargs["redirect_uri"] == "https://www.getpostman.com/oauth2/callback"
        return {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
        }


class MultiAccountFreeAgentClient(FakeFreeAgentClient):
    def get_bank_accounts(self, access_token: str):
        assert access_token == "access-token"
        return [*BANK_ACCOUNTS, MONZO_ACCOUNT]

    def get_bank_transactions(self, **kwargs):
        self.last_transaction_query = kwargs
        if kwargs["bank_account_url"] == MONZO_ACCOUNT["url"]:
            return MONZO_TRANSACTIONS
        return BANK_TRANSACTIONS


def test_freeagent_credentials_are_encrypted_and_validated(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    status = save_credentials(credentials(), db_session, secret_store=store)

    connection = db_session.scalar(select(IntegrationConnection))
    assert status.configured is True
    assert connection is not None
    assert connection.client_id == "client-id-1234"
    assert "client-secret" not in connection.encrypted_client_secret
    assert "access-token" not in connection.encrypted_access_token

    validation = validate_connection(
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )

    assert validation.status.validated is True
    assert validation.status.company_name == "Example Ltd"
    assert validation.accounts[0].name == "Hsbc Personal"


def test_freeagent_credentials_trim_bearer_prefix_and_allow_blank_refresh_token(
    db_session: Session,
) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    payload = credentials()
    payload.access_token = "  Bearer access-token  "
    payload.refresh_token = ""

    save_credentials(payload, db_session, secret_store=store)

    connection = db_session.scalar(select(IntegrationConnection))
    assert connection is not None
    assert store.decrypt(connection.encrypted_access_token) == "access-token"
    assert store.decrypt(connection.encrypted_refresh_token) == ""
    validation = validate_connection(
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )
    assert validation.status.validated is True


def test_freeagent_oauth_code_exchange_stores_refresh_token(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")

    status = exchange_authorization_code(
        FreeAgentOAuthExchangeRequest(
            environment="custom",
            base_url="https://mock.freeagent.local",
            client_id="client-id-1234",
            client_secret="client-secret",
            redirect_uri="https://www.getpostman.com/oauth2/callback",
            authorization_code="auth-code",
        ),
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )

    connection = db_session.scalar(select(IntegrationConnection))
    assert status.configured is True
    assert connection is not None
    assert store.decrypt(connection.encrypted_access_token) == "access-token"
    assert store.decrypt(connection.encrypted_refresh_token) == "refresh-token"


def test_freeagent_link_header_next_page_is_detected() -> None:
    link_header = (
        "<https://api.freeagent.com/v2/bank_transactions?page=3>; rel='last', "
        "<https://api.freeagent.com/v2/bank_transactions?page=2>; rel='next'"
    )

    assert parse_next_link(link_header) == "https://api.freeagent.com/v2/bank_transactions?page=2"


def test_freeagent_import_creates_accounts_transactions_and_cursor(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    save_credentials(credentials(), db_session, secret_store=store)
    validate_connection(db_session, secret_store=store, client_factory=FakeFreeAgentClient)

    result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=BANK_ACCOUNTS[0]["url"],
            from_date=date(2026, 1, 1),
            to_date=date(2026, 6, 15),
        ),
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )

    assert result.row_count == 2
    assert result.imported_transaction_count == 2
    assert result.skipped_duplicate_count == 0
    assert result.next_updated_since == "2026-06-15T11:12:27.000Z"
    account = db_session.scalar(select(Account).where(Account.provider == "FreeAgent"))
    assert account is not None
    assert account.display_name == "Hsbc Personal"
    assert str(account.current_balance) == "-409.88"
    assert len(db_session.scalars(select(Transaction)).all()) == 2
    import_log = db_session.scalar(select(ImportLog).where(ImportLog.source == "freeagent_api"))
    assert import_log is not None

    duplicate_result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=BANK_ACCOUNTS[0]["url"],
            updated_since=result.next_updated_since,
        ),
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )

    assert duplicate_result.imported_transaction_count == 0
    assert duplicate_result.skipped_duplicate_count == 2
    assert len(db_session.scalars(select(Transaction)).all()) == 2


def test_freeagent_import_uses_per_account_cursor(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    save_credentials(credentials(), db_session, secret_store=store)
    validate_connection(db_session, secret_store=store, client_factory=MultiAccountFreeAgentClient)

    hsbc_result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=BANK_ACCOUNTS[0]["url"],
            from_date=date(2026, 1, 1),
            to_date=date(2026, 6, 15),
        ),
        db_session,
        secret_store=store,
        client_factory=MultiAccountFreeAgentClient,
    )
    monzo_result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=MONZO_ACCOUNT["url"],
            from_date=date(2026, 6, 1),
            to_date=date(2026, 6, 16),
        ),
        db_session,
        secret_store=store,
        client_factory=MultiAccountFreeAgentClient,
    )

    managed_accounts = db_session.scalars(select(IntegrationAccount)).all()
    cursors = {
        account.external_account_url: account.sync_cursor_updated_since
        for account in managed_accounts
    }
    assert hsbc_result.next_updated_since == "2026-06-15T11:12:27.000Z"
    assert monzo_result.next_updated_since == "2026-06-16T08:45:00.000Z"
    assert cursors[BANK_ACCOUNTS[0]["url"]] == "2026-06-15T11:12:27.000Z"
    assert cursors[MONZO_ACCOUNT["url"]] == "2026-06-16T08:45:00.000Z"


def test_freeagent_manage_account_and_sync_all_auto_accounts(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    save_credentials(credentials(), db_session, secret_store=store)
    validate_connection(db_session, secret_store=store, client_factory=MultiAccountFreeAgentClient)

    managed = manage_bank_account(
        FreeAgentAccountManagementRequest(
            bank_account_url=MONZO_ACCOUNT["url"],
            managed=True,
            auto_sync_enabled=True,
            sync_interval_minutes=1440,
        ),
        db_session,
        secret_store=store,
        client_factory=MultiAccountFreeAgentClient,
    )
    result = sync_all_managed_accounts(
        FreeAgentSyncAllRequest(force=True, only_auto_sync_enabled=True, initial_lookback_days=30),
        db_session,
        secret_store=store,
        client_factory=MultiAccountFreeAgentClient,
    )

    assert managed.auto_sync_enabled is True
    assert result.account_count == 2
    assert result.synced_account_count == 1
    assert result.imported_transaction_count == 1
    assert db_session.scalar(
        select(Account).where(Account.source_account_name.like("Monzo Personal%"))
    ) is not None


def test_duplicate_freeagent_import_preserves_reviewed_transaction_updates(
    db_session: Session,
) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    save_credentials(credentials(), db_session, secret_store=store)
    validate_connection(db_session, secret_store=store, client_factory=FakeFreeAgentClient)

    result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=BANK_ACCOUNTS[0]["url"],
            from_date=date(2026, 1, 1),
            to_date=date(2026, 6, 15),
        ),
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )
    transaction = db_session.scalar(
        select(Transaction).where(Transaction.description == "Day to Day Exp///100.00")
    )
    assert transaction is not None

    update_transaction(
        db_session,
        transaction.entity_id,
        transaction.id,
        TransactionUpdate(transaction_type="family_transfer", reviewed=True),
    )
    duplicate_result = import_bank_transactions(
        FreeAgentImportRequest(
            bank_account_url=BANK_ACCOUNTS[0]["url"],
            updated_since=result.next_updated_since,
        ),
        db_session,
        secret_store=store,
        client_factory=FakeFreeAgentClient,
    )
    db_session.refresh(transaction)

    assert duplicate_result.imported_transaction_count == 0
    assert duplicate_result.skipped_duplicate_count == 2
    assert transaction.transaction_type == "family_transfer"
    assert transaction.reviewed is True
    assert len(db_session.scalars(select(Transaction)).all()) == 2


def test_freeagent_import_requires_first_run_date_range_or_cursor(db_session: Session) -> None:
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    save_credentials(credentials(), db_session, secret_store=store)
    validate_connection(db_session, secret_store=store, client_factory=FakeFreeAgentClient)

    try:
        import_bank_transactions(
            FreeAgentImportRequest(bank_account_url=BANK_ACCOUNTS[0]["url"]),
            db_session,
            secret_store=store,
            client_factory=FakeFreeAgentClient,
        )
    except FreeAgentIntegrationError as exc:
        assert "Choose a date range" in str(exc)
    else:
        raise AssertionError("Expected first FreeAgent import without filters to fail.")


def test_freeagent_routes_support_mock_client(api_client, db_session: Session) -> None:
    api_client.dependency_overrides[get_freeagent_client_factory] = lambda: FakeFreeAgentClient
    client = TestClient(api_client)

    response = client.post(
        "/api/integrations/freeagent/credentials",
        json=credentials().model_dump(mode="json"),
    )
    assert response.status_code == 200

    validation_response = client.post("/api/integrations/freeagent/validate")
    assert validation_response.status_code == 200
    assert validation_response.json()["accounts"][0]["url"] == BANK_ACCOUNTS[0]["url"]

    import_response = client.post(
        "/api/integrations/freeagent/import",
        json={
            "bank_account_url": BANK_ACCOUNTS[0]["url"],
            "from_date": "2026-01-01",
            "to_date": "2026-06-15",
        },
    )

    assert import_response.status_code == 200
    assert import_response.json()["imported_transaction_count"] == 2
    assert db_session.scalar(select(Account).where(Account.provider == "FreeAgent")) is not None


def credentials() -> FreeAgentCredentials:
    return FreeAgentCredentials(
        environment="custom",
        base_url="https://mock.freeagent.local",
        client_id="client-id-1234",
        client_secret="client-secret",
        access_token="access-token",
        refresh_token="refresh-token",
    )
