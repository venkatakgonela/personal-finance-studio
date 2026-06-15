from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class FreeAgentApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class FreeAgentApiClient:
    def __init__(self, base_url: str, token_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token_url = token_url

    def get_company(self, access_token: str) -> dict[str, Any]:
        return self.get_json("/v2/company", access_token).get("company", {})

    def get_bank_accounts(self, access_token: str) -> list[dict[str, Any]]:
        return self.get_json("/v2/bank_accounts", access_token).get("bank_accounts", [])

    def get_bank_transactions(
        self,
        *,
        access_token: str,
        bank_account_url: str,
        from_date: str | None = None,
        to_date: str | None = None,
        updated_since: str | None = None,
        view: str = "all",
        last_uploaded: bool = False,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {
            "bank_account": bank_account_url,
            "view": view,
        }
        if last_uploaded:
            params["last_uploaded"] = "true"
        if from_date:
            params["from_date"] = from_date
        if to_date:
            params["to_date"] = to_date
        if updated_since:
            params["updated_since"] = updated_since
        return self.get_json("/v2/bank_transactions", access_token, params).get(
            "bank_transactions",
            [],
        )

    def refresh_access_token(
        self,
        *,
        client_id: str,
        client_secret: str,
        refresh_token: str,
    ) -> dict[str, Any]:
        body = urlencode(
            {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            }
        ).encode("utf-8")
        request = Request(
            self.token_url,
            data=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        return self._send(request)

    def get_json(
        self,
        path: str,
        access_token: str,
        params: Mapping[str, str] | None = None,
    ) -> dict[str, Any]:
        query = f"?{urlencode(params)}" if params else ""
        request = Request(
            f"{self.base_url}{path}{query}",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
        )
        return self._send(request)

    def _send(self, request: Request) -> dict[str, Any]:
        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read().decode("utf-8")
        except HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            raise FreeAgentApiError(extract_error_message(payload), exc.code) from exc
        except URLError as exc:
            raise FreeAgentApiError(f"FreeAgent request failed: {exc.reason}") from exc

        if not payload:
            return {}
        try:
            return json.loads(payload)
        except json.JSONDecodeError as exc:
            raise FreeAgentApiError("FreeAgent returned invalid JSON.") from exc


def extract_error_message(payload: str) -> str:
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return payload or "FreeAgent request failed."
    error = parsed.get("errors", {}).get("error", {})
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])
    return payload or "FreeAgent request failed."
