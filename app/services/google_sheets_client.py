from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class GoogleSheetsApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class GoogleSheetsApiClient:
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    api_base_url = "https://sheets.googleapis.com/v4/spreadsheets"
    readonly_scope = "https://www.googleapis.com/auth/spreadsheets.readonly"

    def build_authorization_url(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        state: str,
    ) -> str:
        return f"{self.auth_url}?{urlencode({
            'access_type': 'offline',
            'client_id': client_id,
            'include_granted_scopes': 'true',
            'prompt': 'consent select_account',
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': self.readonly_scope,
            'state': state,
        })}"

    def exchange_authorization_code(
        self,
        *,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        return self.post_token(
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }
        )

    def refresh_access_token(
        self,
        *,
        client_id: str,
        client_secret: str,
        refresh_token: str,
    ) -> dict[str, Any]:
        return self.post_token(
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
        )

    def post_token(self, payload: dict[str, str]) -> dict[str, Any]:
        request = Request(
            self.token_url,
            data=urlencode(payload).encode(),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        return self._send(request)

    def get_values(
        self,
        *,
        access_token: str,
        spreadsheet_id: str,
        value_range: str,
    ) -> list[list[Any]]:
        params = urlencode(
            {
                "dateTimeRenderOption": "SERIAL_NUMBER",
                "majorDimension": "ROWS",
                "valueRenderOption": "UNFORMATTED_VALUE",
            }
        )
        encoded_range = quote(value_range, safe="")
        url = f"{self.api_base_url}/{spreadsheet_id}/values/{encoded_range}?{params}"
        request = Request(
            url,
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
            method="GET",
        )
        payload = self._send(request)
        values = payload.get("values", [])
        if not isinstance(values, list):
            raise GoogleSheetsApiError("Google Sheets returned an invalid values payload.")
        return values

    def _send(self, request: Request) -> dict[str, Any]:
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise GoogleSheetsApiError(extract_error_message(detail), exc.code) from exc
        except URLError as exc:
            raise GoogleSheetsApiError(f"Google Sheets request failed: {exc.reason}") from exc
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:
            raise GoogleSheetsApiError("Google Sheets returned invalid JSON.") from exc
        if not isinstance(payload, dict):
            raise GoogleSheetsApiError("Google Sheets returned an invalid JSON object.")
        return payload


def extract_error_message(raw: str) -> str:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return raw or "Google Sheets request failed."
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = str(error.get("message") or "Google Sheets request failed.")
            if message == "The caller does not have permission":
                return (
                    "Google connected, but the signed-in account cannot read this Sheet. "
                    "Share the Sheet with that Google account or reconnect and choose the "
                    "account that owns the Sheet."
                )
            return message
        if isinstance(error, str):
            return error
    return raw or "Google Sheets request failed."
