from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Account, Transaction
from app.schemas.google_sheets import GoogleSheetsConfig
from app.services.monzo_google_sheets import (
    exchange_authorization_code,
    get_connection,
    import_transactions,
    save_config,
    validate_connection,
)
from app.services.secret_store import SecretStore, normalize_key


class FakeGoogleSheetsClient:
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    readonly_scope = "https://www.googleapis.com/auth/spreadsheets.readonly"

    def build_authorization_url(self, *, client_id: str, redirect_uri: str, state: str) -> str:
        return f"https://auth.example.test?client_id={client_id}&redirect_uri={redirect_uri}&state={state}"

    def exchange_authorization_code(
        self,
        *,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
    ) -> dict[str, str]:
        assert client_id == "google-client"
        assert client_secret == "google-secret"
        assert code == "oauth-code"
        assert redirect_uri == redirect_uri_for_tests()
        return {"access_token": "access-token", "refresh_token": "refresh-token"}

    def get_values(
        self,
        *,
        access_token: str,
        spreadsheet_id: str,
        value_range: str,
    ) -> list[list[object]]:
        assert access_token == "access-token"
        assert spreadsheet_id == "1nx6-x3vG1vDD7Wk1DpxUl0bH-gXvQKrF6nBqROfv8Ck"
        assert value_range.startswith("'Personal Account Transactions'!")
        return monzo_values()


def test_monzo_google_sheets_oauth_and_import_are_idempotent(
    db_session: Session,
    monkeypatch,
) -> None:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "google-client")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "google-secret")
    get_settings.cache_clear()
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    client = FakeGoogleSheetsClient()

    status = save_config(config(), db_session, secret_store=store, client=client)
    connection = get_connection(db_session)
    assert connection is not None
    assert status.configured is True
    assert status.auth_url is not None

    connected = exchange_authorization_code(
        code="oauth-code",
        state=connection.id,
        session=db_session,
        secret_store=store,
        client=client,
    )
    assert connected.validated is True

    validated = validate_connection(db_session, secret_store=store, client=client)
    assert validated.validated is True

    first = import_transactions(db_session, secret_store=store, client=client)
    second = import_transactions(db_session, secret_store=store, client=client)

    assert first.imported_transaction_count == 4
    assert first.skipped_duplicate_count == 0
    assert second.imported_transaction_count == 0
    assert second.skipped_duplicate_count == 4

    current = db_session.scalar(
        select(Account).where(
            Account.provider == "Monzo",
            Account.source_account_name == "Monzo Current",
        )
    )
    kids = db_session.scalar(
        select(Account).where(
            Account.provider == "Monzo",
            Account.source_account_name == "Monzo Pot: Kids",
        )
    )
    flex = db_session.scalar(
        select(Account).where(
            Account.provider == "Monzo",
            Account.source_account_name == "Monzo Flex",
        )
    )
    assert current is not None
    assert kids is not None
    assert flex is not None
    assert current.current_balance == 90
    assert kids.current_balance == 5
    assert flex.account_type == "bnpl"
    assert flex.include_in_cash_on_hand is False
    assert flex.current_balance is None
    flex_payment = db_session.scalar(
        select(Transaction).where(
            Transaction.account_id == current.id,
            Transaction.description == "Flex",
        )
    )
    assert flex_payment is not None
    assert flex_payment.source_category == "Monzo Flex"
    assert flex_payment.transaction_type == "debt_payment"
    assert db_session.query(Transaction).count() == 4
    get_settings.cache_clear()


def config() -> GoogleSheetsConfig:
    return GoogleSheetsConfig(
        redirect_uri=redirect_uri_for_tests(),
        spreadsheet_url=(
            "https://docs.google.com/spreadsheets/d/"
            "1nx6-x3vG1vDD7Wk1DpxUl0bH-gXvQKrF6nBqROfv8Ck/edit"
        ),
        sheet_name="Personal Account Transactions",
    )


def redirect_uri_for_tests() -> str:
    return "http://127.0.0.1:8025/api/integrations/google-sheets/monzo/oauth/callback"


def monzo_values() -> list[list[object]]:
    return [
        [
            "Transaction ID",
            "Date",
            "Time",
            "Type",
            "Name",
            "Emoji",
            "Category",
            "Amount",
            "Currency",
            "Local amount",
            "Local currency",
            "Notes and #tags",
            "Address",
            "Receipt",
            "Description",
            "Category split",
            "Pot name",
        ],
        [
            "tx-income", 45918, 0.1, "Faster payment", "Salary", "", "Income", 200,
            "GBP", 200, "GBP", "", "", "", "Salary", "", "",
        ],
        [
            "tx-card", 45918, 0.2, "Card payment", "Shop", "", "Shopping", -10,
            "GBP", -10, "GBP", "", "", "", "SHOP", "", "",
        ],
        [
            "tx-pot", 45918, 0.3, "Pot transfer", "Kids Pot", "", "Transfers", 5,
            "GBP", 5, "GBP", "", "", "", "", "", "Kids",
        ],
        [
            "tx-flex", 45918, 0.4, "Transfer", "", "", "Transfers", -100,
            "GBP", -100, "GBP", "", "", "", "Flex", "", "",
        ],
    ]
