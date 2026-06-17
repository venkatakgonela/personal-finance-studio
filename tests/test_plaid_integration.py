from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Account, Transaction
from app.schemas.plaid import PlaidExchangeRequest, PlaidImportRequest
from app.services.plaid_integration import (
    create_link_token,
    exchange_public_token,
    get_status,
    import_plaid,
    preview_plaid,
)
from app.services.secret_store import SecretStore, normalize_key


class FakePlaidClient:
    base_url = "https://sandbox.plaid.com"

    def create_link_token(self, **kwargs):
        assert kwargs["client_id"] == "plaid-client"
        assert kwargs["secret"] == "plaid-secret"
        assert kwargs["country_codes"] == ["GB"]
        assert kwargs["products"] == ["transactions"]
        return {
            "expiration": "2026-06-17T13:00:00Z",
            "link_token": "link-sandbox-token",
            "request_id": "request-link",
        }

    def exchange_public_token(self, **kwargs):
        assert kwargs["public_token"] == "public-sandbox-token"
        return {"access_token": "access-sandbox-token", "item_id": "item-hsbc"}

    def accounts_balance_get(self, **kwargs):
        assert kwargs["access_token"] == "access-sandbox-token"
        return {
            "accounts": [
                {
                    "account_id": "plaid-current",
                    "balances": {"available": 95.25, "current": 125.25, "limit": None},
                    "mask": "1234",
                    "name": "Current",
                    "official_name": "HSBC Advance Current",
                    "subtype": "checking",
                    "type": "depository",
                },
                {
                    "account_id": "plaid-credit",
                    "balances": {"available": 400.00, "current": 250.00, "limit": 650.00},
                    "mask": "9876",
                    "name": "Credit Card",
                    "official_name": "Aqua Credit Card",
                    "subtype": "credit card",
                    "type": "credit",
                },
            ],
            "item": {"institution_name": "HSBC"},
        }

    def transactions_get(self, **kwargs):
        return {
            "total_transactions": 2,
            "transactions": [
                {
                    "account_id": "plaid-current",
                    "amount": 29.99,
                    "category": ["Shops", "Groceries"],
                    "date": "2026-06-15",
                    "merchant_name": "Morrisons",
                    "name": "MORRISONS",
                    "payment_channel": "in store",
                    "pending": False,
                    "transaction_id": "tx-plaid-shop",
                },
                {
                    "account_id": "plaid-credit",
                    "amount": 100.00,
                    "category": ["Transfer"],
                    "date": "2026-06-14",
                    "merchant_name": "",
                    "name": "Credit card payment",
                    "payment_channel": "online",
                    "pending": False,
                    "transaction_id": "tx-plaid-card-payment",
                },
            ],
        }


def test_plaid_link_exchange_preview_and_import_are_idempotent(
    db_session: Session,
    monkeypatch,
) -> None:
    monkeypatch.setenv("PLAID_CLIENT_ID", "plaid-client")
    monkeypatch.setenv("PLAID_SECRET", "plaid-secret")
    monkeypatch.setenv("PLAID_ENV", "sandbox")
    monkeypatch.setenv("PLAID_PRODUCTS", "transactions")
    monkeypatch.setenv("PLAID_COUNTRY_CODES", "GB")
    get_settings.cache_clear()
    store = SecretStore(normalize_key("test-secret-key"), "test secret store")
    client = FakePlaidClient()

    status = get_status(db_session, secret_store=store)
    assert status.configured is True
    assert status.connected is False

    link_token = create_link_token(db_session, secret_store=store, client=client)
    assert link_token.link_token == "link-sandbox-token"

    connected = exchange_public_token(
        PlaidExchangeRequest(
            institution_id="ins_123",
            institution_name="HSBC",
            public_token="public-sandbox-token",
        ),
        db_session,
        secret_store=store,
        client=client,
    )
    assert connected.connected is True

    preview = preview_plaid(db_session, days=30, secret_store=store, client=client)
    assert len(preview.accounts) == 2
    assert preview.accounts[0].institution_name == "HSBC"
    assert preview.transaction_count == 2

    first = import_plaid(
        PlaidImportRequest(days=30),
        db_session,
        secret_store=store,
        client=client,
    )
    second = import_plaid(
        PlaidImportRequest(days=30),
        db_session,
        secret_store=store,
        client=client,
    )

    assert first.account_count == 2
    assert first.imported_transaction_count == 2
    assert second.imported_transaction_count == 0
    assert second.skipped_duplicate_count == 2

    current = db_session.scalar(
        select(Account).where(Account.source_account_name.like("HSBC HSBC Advance Current%"))
    )
    credit = db_session.scalar(
        select(Account).where(Account.source_account_name.like("HSBC Aqua Credit Card%"))
    )
    assert current is not None
    assert credit is not None
    assert current.current_balance == 125.25
    assert current.account_type == "current"
    assert credit.current_balance == -250
    assert credit.account_type == "credit_card"
    assert credit.overdraft_limit == 650
    assert db_session.query(Transaction).count() == 2
    get_settings.cache_clear()
