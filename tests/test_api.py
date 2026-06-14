from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"


def test_health_endpoint() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_snoop_preview_endpoint() -> None:
    client = TestClient(create_app())

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        response = client.post(
            "/api/imports/snoop/preview",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["row_count"] == 5
    assert payload["date_start"] == "2026-06-09"
    assert payload["date_end"] == "2026-06-14"


def test_snoop_commit_endpoint(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        response = client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["entity_name"] == "Household"
    assert payload["profile_name"] == "Kiran"
    assert payload["imported_transaction_count"] == 5
    assert payload["created_account_count"] == 2


def test_transfer_detect_endpoint(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )

    response = client.post("/api/transfers/detect")

    assert response.status_code == 200
    payload = response.json()
    assert payload["created_count"] == 1
    assert payload["candidate_count"] == 1
    assert len(payload["candidates"]) == 1
    assert payload["candidates"][0]["amount"] == "340.00"


def test_accounts_and_transactions_endpoints(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )
    client.post("/api/transfers/detect")

    accounts_response = client.get("/api/accounts")
    transactions_response = client.get("/api/transactions?include_transfer_candidates=false")

    assert accounts_response.status_code == 200
    assert len(accounts_response.json()["accounts"]) == 2
    assert transactions_response.status_code == 200
    assert transactions_response.json()["total_count"] == 3


def test_transactions_endpoint_applies_ledger_filters(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )

    income_response = client.get(
        "/api/transactions"
        "?include_transfer_candidates=false"
        "&start_date=2026-06-01"
        "&end_date=2026-06-30"
        "&normalized_group=income"
    )
    spending_response = client.get(
        "/api/transactions?include_transfer_candidates=false&transaction_type=expense"
    )
    reviewed_response = client.get(
        "/api/transactions?include_transfer_candidates=false&reviewed=true"
    )

    assert income_response.status_code == 200
    income_payload = income_response.json()
    assert income_payload["total_count"] == 1
    assert income_payload["transactions"][0]["normalized_group"] == "income"

    assert spending_response.status_code == 200
    spending_payload = spending_response.json()
    assert spending_payload["total_count"] == 1
    assert spending_payload["transactions"][0]["transaction_type"] == "spending"

    assert reviewed_response.status_code == 200
    assert reviewed_response.json()["total_count"] == 0


def test_commitments_endpoints(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_recurring.csv").open("rb") as csv_file:
        client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_recurring.csv", csv_file, "text/csv")},
        )

    detect_response = client.post("/api/commitments/detect")
    list_response = client.get("/api/commitments")

    assert detect_response.status_code == 200
    assert detect_response.json()["created_count"] == 1
    assert list_response.status_code == 200
    assert list_response.json()["total_count"] == 1
    assert list_response.json()["commitments"][0]["name"] == "Netflix"


def test_decision_queue_endpoint_and_action(api_client, db_session: Session) -> None:
    client = TestClient(api_client)

    with (FIXTURES / "snoop_minimal.csv").open("rb") as csv_file:
        client.post(
            "/api/imports/snoop/commit",
            files={"file": ("snoop_minimal.csv", csv_file, "text/csv")},
        )
    client.post("/api/transfers/detect")

    queue_response = client.get("/api/decisions")

    assert queue_response.status_code == 200
    payload = queue_response.json()
    assert payload["total_count"] == 1
    decision = payload["decisions"][0]

    action_response = client.post(
        f"/api/decisions/{decision['decision_type']}/{decision['id']}/confirm"
    )

    assert action_response.status_code == 200
    assert action_response.json()["status"] == "confirmed"
    assert client.get("/api/decisions").json()["total_count"] == 0
