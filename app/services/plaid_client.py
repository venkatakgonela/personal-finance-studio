from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class PlaidApiError(RuntimeError):
    """Raised when Plaid returns an API or transport error."""


class PlaidApiClient:
    base_urls = {
        # Plaid decommissioned the old Development host; Trial/live testing uses Production.
        "development": "https://production.plaid.com",
        "production": "https://production.plaid.com",
        "sandbox": "https://sandbox.plaid.com",
    }

    def __init__(self, environment: str = "sandbox") -> None:
        self.environment = environment if environment in self.base_urls else "sandbox"
        self.base_url = self.base_urls[self.environment]

    def create_link_token(
        self,
        *,
        client_id: str,
        client_name: str,
        country_codes: list[str],
        products: list[str],
        secret: str,
        user_id: str,
    ) -> dict[str, Any]:
        return self.post_json(
            "/link/token/create",
            {
                "client_id": client_id,
                "client_name": client_name,
                "country_codes": country_codes,
                "language": "en",
                "products": products,
                "secret": secret,
                "user": {"client_user_id": user_id},
            },
        )

    def exchange_public_token(
        self,
        *,
        client_id: str,
        public_token: str,
        secret: str,
    ) -> dict[str, Any]:
        return self.post_json(
            "/item/public_token/exchange",
            {
                "client_id": client_id,
                "public_token": public_token,
                "secret": secret,
            },
        )

    def accounts_balance_get(
        self,
        *,
        access_token: str,
        client_id: str,
        secret: str,
    ) -> dict[str, Any]:
        return self.post_json(
            "/accounts/balance/get",
            {
                "access_token": access_token,
                "client_id": client_id,
                "secret": secret,
            },
        )

    def transactions_get(
        self,
        *,
        access_token: str,
        client_id: str,
        end_date: str,
        secret: str,
        start_date: str,
        count: int = 250,
        offset: int = 0,
    ) -> dict[str, Any]:
        return self.post_json(
            "/transactions/get",
            {
                "access_token": access_token,
                "client_id": client_id,
                "end_date": end_date,
                "options": {"count": count, "offset": offset},
                "secret": secret,
                "start_date": start_date,
            },
        )

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise PlaidApiError(read_plaid_error(details) or details or str(exc)) from exc
        except urllib.error.URLError as exc:
            raise PlaidApiError(str(exc.reason)) from exc

        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise PlaidApiError("Plaid returned an invalid JSON response.") from exc


def read_plaid_error(details: str) -> str:
    try:
        payload = json.loads(details)
    except json.JSONDecodeError:
        return ""
    return str(
        payload.get("display_message")
        or payload.get("error_message")
        or payload.get("error_code")
        or ""
    )
