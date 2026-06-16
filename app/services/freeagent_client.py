from __future__ import annotations

import json
from collections.abc import Mapping
from email.message import Message
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode
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
        per_page: int = 100,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {
            "bank_account": bank_account_url,
            "per_page": str(max(1, min(per_page, 100))),
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
        rows: list[dict[str, Any]] = []
        next_url: str | None = f"{self.base_url}/v2/bank_transactions?{urlencode(params)}"
        while next_url:
            payload, headers = self.get_json_url(next_url, access_token)
            page_rows = payload.get("bank_transactions", [])
            if isinstance(page_rows, list):
                rows.extend(page_rows)
            next_url = parse_next_link(headers.get("Link", ""))
        return rows

    def exchange_authorization_code(
        self,
        *,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        body = urlencode(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
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

    def get_json_url(self, url: str, access_token: str) -> tuple[dict[str, Any], Message]:
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
        )
        return self._send_with_headers(request)

    def _send(self, request: Request) -> dict[str, Any]:
        payload, _headers = self._send_with_headers(request)
        return payload

    def _send_with_headers(self, request: Request) -> tuple[dict[str, Any], Message]:
        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read().decode("utf-8")
                headers = response.headers
        except HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            raise FreeAgentApiError(extract_error_message(payload), exc.code) from exc
        except URLError as exc:
            raise FreeAgentApiError(f"FreeAgent request failed: {exc.reason}") from exc

        if not payload:
            return {}, headers
        try:
            return json.loads(payload), headers
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


def parse_next_link(link_header: str) -> str | None:
    for part in link_header.split(","):
        section = part.strip()
        if not section.startswith("<") or ">;" not in section:
            continue
        url, raw_params = section[1:].split(">;", 1)
        cleaned_params = raw_params.replace(";", "&").replace('"', "").replace("'", "")
        params = dict(
            parse_qsl(cleaned_params.replace(" ", ""))
        )
        if params.get("rel") == "next":
            return url
    return None
